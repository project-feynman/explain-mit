import db from "@/database.js";
import { getRandomId, getCurrentTimeInEST } from "@/helpers.js";
import firebase from "firebase/app";
import "firebase/firestore";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import { mapState } from "vuex"; 
import { MASSIVE_MODE_DIMENSIONS } from "@/CONSTANTS.js";

export default {
  mixins: [
    DatabaseHelpersMixin
  ],
  computed: {
    ...mapState([
      "user",
      "mitClass"
    ]),
    simplifiedUser () {
      if (!this.user) return; 
      return {
        email: this.user.email,
        uid: this.user.uid,
        firstName: this.user.firstName,
        lastName: this.user.lastName
      }
    }
  },
  methods: {
    /**
     * Save the explanation data into the global Vuex store (so the data doesn't disappear
     * if this component is destroyed), then initiates the upload process.
     * 
     * @params this contains the properties `postTitle`, `strokesArray`, etc. which defines the explanation 
     * @effect uploads the explanation data to Firestore and Firebase Storage
     */
    async $_saveExplToCacheThenUpload ({ thumbnailBlob, audioBlob, backgroundImageBlob, html, title, tags, explRef, aspectRatio }) {
      const postOrder = parseInt(this.mitClass.maxOrder + 1) || 1; 

      // experimental: if only part of the blackboard has drawing, then the resulting video would have lots of unused spaces
      // therefore, eliminate it by calculating the maximum x,y values with drawings
      let maxUnitX = 0; 
      let maxUnitY = 0; 
      for (const stroke of this.strokesArray) {
        for (const point of stroke.points) {
          if (point.unitX > maxUnitX) maxUnitX = point.unitX; 
          if (point.unitY > maxUnitY) maxUnitY = point.unitY; 
        }
      }
      let { HEIGHT, WIDTH } = MASSIVE_MODE_DIMENSIONS; 
      const epsilon = 20; 
      // width and height should be arbitary, but for now it's the massive mode dimensions

      let trueWidth = maxUnitX * WIDTH; 
      let trueHeight = maxUnitY * HEIGHT; 

      // add a 10% margin for empty space around the side of the video
      trueWidth = trueWidth * 1.1; 
      trueHeight = trueHeight * 1.1; 

      let trueAspectRatio = trueWidth / trueHeight; 
      console.log("trueAspectRatio =", trueAspectRatio); 

      // now the unitX and unitY values are off because the number that they are divided by is different
      for (const stroke of this.strokesArray) {
        for (const point of stroke.points) {
          point.unitX = (point.unitX * WIDTH) / trueWidth; 
          point.unitY = (point.unitY * HEIGHT) / trueHeight; 
        }
      }

      this.$store.commit("ADD_EXPL_TO_CACHE", {
        ref: explRef, // to uniquely identify each explanation when there are simultaneous uploads
        strokesArray: this.strokesArray,
        backgroundImageBlob,
        thumbnailBlob,
        audioBlob,
        metadata: {
          title,
          html,
          date: getCurrentTimeInEST().toISOString(),
          creator: this.isAnonymous ? this.anonymousUser : this.simplifiedUser,
          mitClass: {
            id: this.mitClass.id,
            name: this.mitClass.name,
            description: this.mitClass.description
          },
          tags,
          order: postOrder,
          duration: this.blackboard.currentTime, 
          aspectRatio: trueAspectRatio,
          hasStrokes: this.strokesArray.length > 0
        }
      });
      db.doc(`classes/${this.$route.params.class_id}`).update({
        maxOrder: postOrder,
      });
      this.mitClass.maxOrder = postOrder;
      this.$_uploadExplanation(explRef); 
      this.$root.$emit("show-snackbar", "Uploading your explanation...");
      this.$emit("upload-started"); // let the clients i.e. ClassPageSeePost and ClassPageNewPost re-render the <CreateExplanation/> component
    },
    /**
     * @param {*} context a reference to the Vuex store, and is automatically injected when the method is called using `$store.dispatch()`
     * @param {*} ref the location on Firestore to which the explanation document will be uploaded. 
     *                Moreover, ref.id maps to the specific explanation from the expl cache. 
     * @returns Uploads the explanation. If the upload fails for any reason,
     * this function will call itself after 5 seconds to re-attempt the upload.
     */
    async $_uploadExplanation (ref, retryCount = 0) {
      try {
        const explData = this.$store.state.explCache[ref.id];
        const { strokesArray, audioBlob, thumbnailBlob, backgroundImageBlob } = explData; 
        const explDoc = { ...explData.metadata }; // we build up each property of `explDoc` then upload it Firestore
        const promises = []; // upload thumbnail, audio, images and strokes in parallel 
        if (strokesArray.length > 0 || backgroundImageBlob) { // if the blackboard was used
          promises.push(
            this.$_uploadStrokesToDatabase(strokesArray, ref.collection("strokes"))
          );
          promises.push(
            this.$_saveToStorage(getRandomId(), thumbnailBlob).then(URL => explDoc.thumbnail = URL)
          );
          if (audioBlob) {
            promises.push(
              this.$_saveToStorage(getRandomId(), audioBlob).then(URL => explDoc.audioUrl = URL)
            );
          } 
          if (backgroundImageBlob) {
            promises.push(
              this.$_saveToStorage(getRandomId(), backgroundImageBlob).then(URL => explDoc.imageUrl = URL)
            );
          }
        }
        await Promise.all(promises);
        // TODO: refactor the below logic to the client
        if (!this.newReplyRef) { // this is not a reply
          explDoc.participants = [this.simplifiedUser];
          explDoc.hasReplies = false;
        } else { // this is a reply
          promises.push(
            this.newPostRef.update({ // this is a reply, and newPostRef is the original post
              participants: firebase.firestore.FieldValue.arrayUnion(this.simplifiedUser),
              hasReplies: true
            })
          );
        }
        // save the explanation doc itself
        promises.push(ref.set(explDoc));
        await Promise.all(promises);
        delete this.$store.state.explCache[ref.id];
        this.$root.$emit("show-snackbar", "Successfully saved your explanation.");   
      } catch (error) {
        // TODO: send an error email to ExplainMIT core team
        console.log("error =", error);
        const maxRetryCount = 5;
        this.$root.$emit(
          "show-snackbar", 
          `Upload failed (trying ${maxRetryCount - retryCount} more times)`
        );
        if (retryCount < maxRetryCount) {
          setTimeout(() => this.$_uploadExplanation(ref, retryCount + 1), 5000); // set a delay in case the upload failure is immediate and will overwhelm the call stack
        }
      }
    },
    /**
     * @param strokesArray an array of stroke objects
     * @param databaseRef location on Firestore where the stroke documents will be uploaded
     * @effect uploads each stroke of the array to databaseRef, splitting into batches if necessary. 
     */
    $_uploadStrokesToDatabase (strokesArray, databaseRef) {
      return new Promise(async (resolve, reject) => {
        try {
          const promises = [];
          let currentBatch = db.batch();
          let currentBatchSize = 0; 
          const maxBatchSize = 500; 

          for (const stroke of this.strokesArray) {
            if (currentBatchSize >= maxBatchSize) {
              promises.push(currentBatch.commit());
              currentBatch = db.batch(); 
              currentBatchSize = 0; 
            } 
            currentBatch.set(databaseRef.doc(getRandomId()), stroke);
            currentBatchSize += 1;
          }
          promises.push(currentBatch.commit()); 
          await Promise.all(promises);
          resolve();
        } catch (reason) {
          console.log("failed, reason =", reason);
          reject(reason);
        }
      });
    }
  }
}
