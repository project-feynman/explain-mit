<template>
  <div>
    <!-- START OF "SPACE ACTIONS" dropdown menu -->
    <!-- The triple dot dropdown menu with actions that affects the whole open space -->
    <portal to="current-open-space-actions">
      <v-menu v-if="roomTypeDoc" 
        v-model="isMenuOpen" 
        bottom nudge-left offset-y
      >
        <template v-slot:activator>
          <BaseButton @click="isMenuOpen = true" stopPropagation icon="mdi-dots-vertical" color="black" small>
            <!-- Space actions -->
          </BaseButton>
        </template>

        <v-list>
          <v-list-item><b>During class</b></v-list-item> 

          <!-- For some reason you need click.stop -->
          <v-list-item :disabled="!isAdmin" @click.stop="isBirdsEyeViewPopupOpen = true">
            <v-icon left color="purple">mdi-eye-outline</v-icon> Bird's-eye view
          </v-list-item>

          <ParticularOpenSpaceBirdsEyeViewPopup v-if="participants" 
            :value="isBirdsEyeViewPopupOpen"
            @input="newValue => isBirdsEyeViewPopupOpen = newValue"
            :participants="participants"
          />

          <v-list-item :disabled="!isAdmin" @click="muteParticipantsInRooms(roomTypeDoc.id)" >
            <v-icon left color="orange">mdi-volume-off</v-icon> Mute everyone to stop echoes
          </v-list-item>


          <v-list-item @click="showMakeAnnouncementPopup(roomTypeDoc.id)">
            <v-icon left color="blue">mdi-bullhorn</v-icon> Make announcement
          </v-list-item>

          <BasePopupButton>
            <template v-slot:activator-button="{ on, openPopup }">
              <v-list-item @click.stop="openPopup()" :disabled="!isAdmin">
                <v-icon left color="blue">mdi-file-pdf</v-icon> Add background to every table
              </v-list-item>
            </template>
            <template v-slot:message-to-user>
              <p>
                If you upload a single image/PDF, the page will be placed on your specified board number.
                <br>
                <br>
                If you upload a multi-page PDF, the pages will be placed sequentially on the boards, <u>starting</u> from your specified board number.
                For example, if your PDF has 3 pages: page 1, page 2 and page 3, then board 1 gets page 1, board 2 gets page 2 and board 3 gets page 3. 
              </p>

                 <v-row>
                <v-col>
                  Specify the starting board number
                </v-col>
                <v-col cols="12" sm="4">
                  <v-overflow-btn 
                    label="1"
                    :items="[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]"
                    @change="newVal => targetBoardNum = (newVal - 1)"
                  />
                </v-col>
              </v-row>
            </template>
            <template v-slot:popup-content="{ closePopup }">
              <v-btn @click="$refs.fileInput.click()" block color="green" class="white--text">
                Select file
              </v-btn>
              <input 
                @change="e => { seedEachRoomWithProblem(e); closePopup(); incrementKeyToDestroy += 1; }" 
                style="display: none" 
                type="file" 
                ref="fileInput"
                :key="incrementKeyToDestroy"
              >
            </template>
            <!-- QUICKFIX TO MAKE IT INVISIBLE -->
            <template v-slot:popup-action-buttons>
              <div></div>
            </template>
          </BasePopupButton>

          <BasePopupButton actionName="Shuffle everyone" @action-do="shuffleParticipants(roomTypeDoc.id)">
            <template v-slot:activator-button="{ on, openPopup }">
              <v-list-item :disabled="!isAdmin" @click.stop="openPopup()">
                <v-icon left color="blue">mdi-dice-5</v-icon> Randomly shuffle everyone
              </v-list-item>
            </template>
            <template v-slot:message-to-user>
              <v-row>
                <v-col cols="12" sm="4">
                  <v-overflow-btn 
                    label="3"
                    :items="[2, 3, 4, 5]"
                    @change="groupSize => groupSize = groupSize"
                  />
                </v-col>
                <v-col>
                  <h3 class="mt-5">
                    people per group
                  </h3>
                </v-col>
              </v-row>
            </template> 
          </BasePopupButton>


          <v-divider/>

          <v-list-item><b>Outside of class</b></v-list-item> 

          <BasePopupButton actionName="Wipe everything" @action-do="resetAbsolutelyEverything()">
            <template v-slot:activator-button="{ on, openPopup }">
              <v-list-item :disabled="!isAdmin" @click.stop="openPopup()">
                <v-icon left color="red">mdi-delete</v-icon> Wipe boards in every table
              </v-list-item>
            </template>
            <template v-slot:message-to-user>
              Are you sure?
              This will wipe all the blackboards in this area
            </template> 
          </BasePopupButton>

          <!-- TODO: enable only the creators to change their own open spaces -->
          <!-- Rename Area-->
          <v-list-item :disabled="!isAdmin" @click="isRenamePopupOpen = true">
            <v-icon class="mr-2" color="blue">mdi-pencil</v-icon> Rename area
          </v-list-item>

          <!-- Delete open space -->
          <!-- Don't let anyone delete the lobby section -->
          <v-list-item :disabled="!isAdmin || (roomTypeDoc.id === classID)" @click="isDeletePopupOpen = true">
            <v-icon class="mr-2" color="red">mdi-delete</v-icon> Delete area
          </v-list-item>
        </v-list>
      </v-menu>
    </portal>

    <!-- The popup has to be OUTSIDE the menu, otherwise when the menu closes the popup cannot persist -->
    <!-- Alternatively, use click.stop() -->
    <ParticularOpenSpaceRenamePopup 
      :isRenamePopupOpen="isRenamePopupOpen"
      @change="(newVal) => isRenamePopupOpen = newVal"
    />

    <ParticularOpenSpaceDeletePopup
      :isDeletePopupOpen="isDeletePopupOpen"
      @change="(newVal) => isDeletePopupOpen = newVal"
    />

    <!-- END OF "SPACE ACTIONS" dropdown menu -->

    <!-- should just v-for="room in rooms" 
      When you are feeling down, either you have to suddenly do something courageous,
      or you start cleaning up your life. It's usually a combination of both, it leads to a new chapter in life. 
    -->

    <!-- Selectable *should* allow v-chip to be copied and pasted, but it's currently not doing anything -->
  
  <!-- active-class="active-blackboard accent--text" -->
  <!-- ROOMS -->
  <v-list>
     <v-list-item v-for="(room, i) in sortedRooms" :key="room.id"
      :to="`/class/${classID}/section/${sectionID}/room/${room.id}`"
      dense
      color="accent"
      selectable
      class="pl-0 pr-0 mx-2 mb-0"
    >
      <!-- CASE 1: I'm in the room -->
      <template v-if="room.id === currentRoomID">
        <div class="pt-2 pb-3" style="width: 100%">
          <div style="display: flex; align-items; center;" align="center" class="pl-1 pr-0">
            <div v-if="room.name" class="font-weight-normal py-2 pl-1" style="font-size: 0.95em">
              {{ room.name }}
            </div>

            <div v-else-if="room.isCommonRoom" class="font-weight-normal py-2 pl-1" style="font-size: 0.95em">
              common table
            </div>
                  
            <div v-else class="font-weight-normal py-2 pl-1" style="font-size: 0.95em">
              table {{ i - 1 }}
            </div>

            <v-spacer/>

            <portal-target name="table-level-actions">
          
            </portal-target>
          </div>

          <div class="d-flex pl-2" style="max-width: 175px;">
            <v-chip v-if="room.status" color="blue" class="mt-1" small outlined>
              {{ room.status }}
            </v-chip>

            <v-spacer/>
          </div>

          <portal-target name="current-room-participants">

          </portal-target>
        </div>
      </template>

      <!-- CASE 2: I'm not in the room-->
      <template v-else>
        <div style="width: 100%;">
          <div class="d-flex pl-2 py-1 mt-2 font-weight-normal text--secondary" style="font-size: 0.95em; opacity: 90%">
            <div v-if="room.name">
              {{ room.name }}
            </div>

            <div v-else-if="room.isCommonRoom">
              common table
            </div>

            <div v-else>
              table {{ i - 1 }}
            </div>
          </div>
          <v-chip v-if="room.status" class="ml-2" color="blue" outlined small style="max-width: 175px;">
            {{ room.status }}
          </v-chip>

          <div class="pr-2 pb-1 pt-1">
            <div v-for="p in roomIDToParticipants[room.id]" :key="p.id"
              style="display: flex; align-items: center; font-weight: 400; font-size: 0.9em; opacity: 70%"
              class="text--secondary mb-1 caption"
            >
              <div style="padding-left: 12px;">
                {{ p.firstName + " " + p.lastName + `${p.isAdmin ? ' (staff)' : ''}`}}
              </div>

              <v-spacer/>
              
              <div class="ml-2 mr-4">
                <v-icon v-if="p.canHearAudio" small color="green">
                  mdi-video
                </v-icon>

                <v-icon v-if="p.isMusicPlaying" small color="cyan">
                  mdi-music-clef-treble
                </v-icon>

                <v-icon v-if="p.isViewingLibrary" small color="purple">
                  mdi-bookshelf
                </v-icon>
                <v-icon v-else-if="p.isViewingForum" small color="yellow darken-3">
                  mdi-forum
                </v-icon>

                {{ p.currentBoardNumber }} 
              </div>
            </div>
          </div>
        </div>
      </template>
    </v-list-item> 

    <v-list-item v-if="rooms.length !== 0 && rooms.length < 20" @click="createNewRoom()" class="mx-2" style="font-weight: 400; opacity: 50%; font-size: 0.9rem;"> 
      <v-icon left color="black">mdi-plus</v-icon> new table 
    </v-list-item>

  </v-list>

    <!--  to create a gap between the last room and the bottom boundary of the area -->
    <div class="mb-1"></div>  
    
    <!-- Announcement creation popup -->
    <v-dialog :value="makeAnnouncementPopup.show" persistent max-width="600px">
      <v-card>
        <v-card-title>
          <span class="headline">
            Make Announcement
          </span>
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="makeAnnouncementPopup.message"
            placeholder="Type announcement here..."
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="makeAnnouncementPopup.show = false" color="secondary" text>
            Cancel
          </v-btn>
          <v-btn
            @click="makeAnnouncement(makeAnnouncementPopup.message, makeAnnouncementPopup.roomType)"
            color="secondary"
            text
          >
            Make announcement
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Refactor into RealtimeSpace -->
    <HandleAnnouncements v-if="currentRoomDoc" 
      :roomDoc="currentRoomDoc" 
      :key="currentRoomID + '1'"
    />
  </div>
</template>

<script>
import db from "@/database.js";
import { getRandomId } from "@/helpers.js";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import { mapState, mapGetters } from "vuex"; 
import BaseButton from "@/components/BaseButton.vue";
import BasePopupButton from "@/components/BasePopupButton.vue";
import HandleAnnouncements from "@/components/HandleAnnouncements.vue"; 
import ParticularOpenSpaceRenamePopup from "@/components/ParticularOpenSpaceRenamePopup.vue";
import ParticularOpenSpaceDeletePopup from "@/components/ParticularOpenSpaceDeletePopup.vue";
import ParticularOpenSpaceBirdsEyeViewPopup from "@/components/ParticularOpenSpaceBirdsEyeViewPopup.vue"; 

import firebase from "firebase/app";
import "firebase/firestore"; 
import "firebase/functions";
import ClassLibrary from "@/pages/ClassLibrary.vue";
import _ from "lodash"; 

export default {
  name: "ParticularOpenSpace",
  props: {
    sectionID: {
      type: String,
      required: true
    }
  },
  mixins: [
    DatabaseHelpersMixin
  ],
  components: {
    BaseButton,
    BasePopupButton,
    HandleAnnouncements,
    ClassLibrary,
    ParticularOpenSpaceRenamePopup,
    ParticularOpenSpaceDeletePopup,
    ParticularOpenSpaceBirdsEyeViewPopup
  },
  data () {
    return {
      roomIDToParticipants: {},
      showLibrary: false,
      roomTypeDoc: null,
      rooms: [],
      participants: [],
      unsubFuncs: [],
      targetBoardNum: 0,
      isMenuOpen: false,
      makeAnnouncementPopup: {
        show: false,
        roomType: null,
        message: null
      },
      groupSize: 3,
      minRoomSizeOnShuffle: 2,
      incrementKeyToDestroy: 0,
      isRenamePopupOpen: false,
      isDeletePopupOpen: false,
      isBirdsEyeViewPopupOpen: false
    }
  },
  computed: {
    ...mapState([
      "user",
      "mitClass",
      "session",
      "CallObject",
      "dominantSpeaker"
    ]),
    ...mapGetters([
      "isAdmin"
    ]),
    classID () { return this.$route.params.class_id; },
    sessionID () { return this.session.currentID; },
    isInRoom () { return "room_id" in this.$route.params; },
    currentRoomID () { return this.$route.params.room_id; },
    sortedRooms () {
      return [
        ...this.rooms.filter(room => room.isCommonRoom), 
        ...this.rooms.filter(room => ! room.isCommonRoom)
      ];
    },
    currentRoomDoc () {
      return this.rooms.filter(room => room.id === this.$route.params.room_id)[0];
    },
    classDocRef () {
      return db.doc(`classes/${this.classID}`);
    },
    roomTypeRef () {
      return this.classDocRef.collection("roomTypes").doc(this.sectionID); 
    }
  },
  watch: {
    // whenever participants or rooms change (usually participants), we re-compute the entire
    // `roomIDToParticipants` array, but debounce with Lodash so it does not cause lag issues
    participants: {
      immediate: true,
      handler: _.throttle(function () {
        this.updateRoomIDToParticipants();
      }, 1000)
    },
    rooms: {
      immediate: true,
      handler: _.throttle(function () {
        this.updateRoomIDToParticipants();
        this.$store.commit("SET_CURRENT_AREA_ROOMS", this.rooms);
      }, 1000)
    },
    "roomTypeDoc.roomAssignmentsCounter" (newVal, oldVal) {
      if (oldVal && oldVal !== newVal) {
        // don't shuffle instructors
        if (this.isAdmin) return; 

        for (const roomAssignment of this.roomTypeDoc.roomAssignments) {
          if (roomAssignment.assignees.includes(this.user.uid)) {
            if (this.currentRoomID !== roomAssignment.roomID) {
              this.$router.push(`/class/${this.classID}/section/${this.sectionID}/room/${roomAssignment.roomID}`);
              this.$root.$emit("show-snackbar", "You have been put in random room with other people. Have fun :)"); 
            }
          }
        }
      }
    },
    "roomTypeDoc.muteAllCounter" (newVal, oldVal) {
      if (oldVal && oldVal !== newVal) {
        this.CallObject.setLocalAudio(false);
        this.$root.$emit("show-snackbar", "An admin muted everyone"); 
      }
    },
    // Performance-wise, hopefully it's just a pointer 
    roomIDToParticipants (newVal) {
      this.$store.commit("SET_ROOM_ID_TO_PARTICIPANTS", newVal); 
    }
  },
  async created () {
    // navigate to the common room, which will have the same ID as the section category itself
    if (! this.$route.params.room_id) { // if statement handles reloading on the spot
      this.$router.replace(`${this.sectionID}/room/${this.sectionID}`);
    }
    this.$_listenToDoc(this.roomTypeRef, this, "roomTypeDoc")
      .then(unsubFunc => this.unsubFuncs.push(unsubFunc));

    // listen to rooms 
    this.unsubFuncs.push(
      this.$_bindVarToDB({
        varName: "rooms",
        dbRef: this.classDocRef.collection("rooms").where("roomTypeID", "==", this.sectionID),
        component: this
      })
    );

    // listen to section participants
    this.unsubFuncs.push(
      this.$_bindVarToDB({
        varName: "participants",
        dbRef: this.classDocRef.collection("participants").where("roomTypeID", "==", this.sectionID),
        component: this
      })
    );
  },
  destroyed () {
    for (const unsubFunc of this.unsubFuncs) {
      unsubFunc(); 
    }
  },
  methods: {
    updateRoomIDToParticipants () {
      const out = {};
      for (const room of this.rooms) {
        const peopleInRoom = this.participants.filter(p => p.currentRoom === room.id); 
        peopleInRoom.sort((p1, p2) => {
          // pin myself to the top
          if ([p1.sessionID, p2.sessionID].includes(this.sessionID)) {
            return (p2.sessionID === this.sessionID) - (p1.sessionID === this.sessionID);
          } 
          // sort primarily by who is connected to audio 
          else if (p1.canHearAudio !== p2.canHearAudio) {
            return p2.canHearAudio - p1.canHearAudio; 
          } 
          // sort secondarily by the highest board number
          else {
            return p2.currentBoardNumber - p1.currentBoardNumber;
          }
        });
        out[room.id] = peopleInRoom; 
      }
      this.roomIDToParticipants = out;
    },
    async resetAbsolutelyEverything () {
      function deleteAtPath(path) {
        return new Promise((resolve, reject) => {
          var deleteFn = firebase.functions().httpsCallable('recursiveDelete');
          deleteFn({ path: path })
            .then(function(result) {
              console.log('Delete success: ' + JSON.stringify(result));
              resolve(); 
            })
            .catch(function(err) {
              console.log('Delete failed, see console,');
              console.warn(err);
              reject(); 
            });
        });
      }

      this.$root.$emit("show-snackbar", "Reseting absolutely everything (this might take a while)...");
      const promises = []; 
      for (const room of this.rooms) {
        db.doc(`/classes/${this.classID}/rooms/${room.id}`).update({
          status: ""
        });
        for (const boardID of room.blackboards) {
          const boardDbPath = `/classes/${this.classID}/blackboards/${boardID}`;
          promises.push(
            db.doc(boardDbPath).update({ 
              backgroundImageDownloadURL: ""
            })
          );
          promises.push(
            deleteAtPath(`${boardDbPath}/strokes`)
          );
        }
      }
      await Promise.all(promises); 
      this.$root.$emit("show-snackbar", "Succesfully reset everything.");  
    },
    /**
     * Allows the teacher to upload PDF problems to all the rooms at once. 
     * If the PDF is multi-paged, it will populate boards from index `targetBoardNum` till however many
     * extra pages there are. 
     */
    async seedEachRoomWithProblem (e) {
      const uploadedFile = e.target.files[0];
      if (!uploadedFile) return;

      let imageFiles = []; 
      if (uploadedFile.type.split("/")[0] === "image") {
        imageFiles.push(uploadedFile); 
      } else if (uploadedFile.type.split("/")[1] === "pdf") {
        imageFiles = await this.convertPdfToImageFiles(uploadedFile);
      } else {
        this.$root.$emit("show-snackbar", "Error: only image or pdf files are supported for now.");
        return; 
      }

      // create the blackboards upfront if there are not enough in each room
      // defensive programming is good, it gives you more freedom to be daring
      // rename targetBoardNum to "startingBoardNumber"
      // NOTE: highestBoardNumberNeeded and `targetBoardNum` are both 0-indexed
      const boardCreationRequests = []; 
      const highestBoardIndexNeeded = this.targetBoardNum + imageFiles.length - 1; 

      if (highestBoardIndexNeeded > 10) {
        this.$root.$emit("show-snackbar", "Can't upload beyond board number 10!")
        return; 
      }

      console.log("highestBoardIndexNeeded =", highestBoardIndexNeeded);
      // STEP 2/3: automatically create as many extra boards as needed to handle the PDFs
      const batch = db.batch(); 
      for (const room of this.rooms) {
        // note `numberOfNewBoardsNeeded` can be negative, but is naturally handled by the for loop
        const numberOfNewBoardsNeeded = highestBoardIndexNeeded - (room.blackboards.length - 1); 
        console.log("current boards =", room.blackboards.length);
        console.log("new boards needed =", numberOfNewBoardsNeeded);
        for (let i = 0; i < numberOfNewBoardsNeeded; i++) {
          const newBoardID = getRandomId(); 
          batch.set(
            this.classDocRef.collection("blackboards").doc(newBoardID),
            {}
          );
          batch.update(
            this.classDocRef.collection("rooms").doc(room.id),
            { blackboards: firebase.firestore.FieldValue.arrayUnion(newBoardID) }
          );
        }
      }
      await batch.commit(); 
      console.log("all rooms now have enough blackboards"); 

      // STEP 3/3: plant the PDF images
      console.log("imageFiles =", imageFiles);
      const promises = []; 
      for (const [i, imageFile] of imageFiles.entries()) {
        // console.log("processing image number ", i);
        const processOneImage = this.$_saveToStorage(getRandomId(), imageFile).then(downloadURL => {
          const idx = this.targetBoardNum + i; 
          for (const room of this.rooms) {
            // console.log("placing image number ", i, "into a room");
            if (room.blackboards.length > idx) {
              const ref = this.classDocRef.collection("blackboards").doc(room.blackboards[idx]);
              promises.push(
                ref.update({
                  backgroundImageDownloadURL: downloadURL
                })
              );
            } 
          }
        }); 
        promises.push(processOneImage);
      }
      await Promise.all(promises);
      console.log("resolved");
      this.$root.$emit("show-snackbar", "Successfully planted the problem in each room :)")
    },
    async convertPdfToImageFiles (src) {
      // TODO: fix npm errors and use normal imports
      const pdfjs = require("pdfjs-dist/build/pdf.js");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.4.456/pdf.worker.min.js";
      
      const doc = await pdfjs.getDocument(URL.createObjectURL(src)).promise;
      console.log("doc =", doc);
      const files = []; 
      for (let i = 1; i < doc.numPages + 1; i++) {
        const page = await doc.getPage(i);     

        // Render the page on a Node canvas with 100% scale.
        const viewport = page.getViewport({ scale: 1.0 });
        const dummyCanvas = document.createElement("canvas");
        dummyCanvas.width = viewport.width;
        dummyCanvas.height = viewport.height;
        const ctx = dummyCanvas.getContext("2d");
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        
        await page.render(renderContext).promise
        const dataURL = dummyCanvas.toDataURL("image/png");
        const current_date = new Date();
        const file = this.dataURLtoFile(dataURL, current_date.getTime()+'.png');
        files.push(file); 
      }
      console.log("files =", files);
      return files; 
    },
    // https://stackoverflow.com/questions/16968945/convert-base64-png-data-to-javascript-file-objects/16972036
    // function to convert dataURL from canvas to file object
    dataURLtoFile (dataurl, filename) {
      var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while(n--){
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, {type:mime});
    },
    /**
     * Creates a new room and initalized with 1 blackboard
     * TODO: rename roomType to roomTypeID
     * 
     */
    async createNewRoom () {
      const newDocID = getRandomId();
      await Promise.all([
        this.classDocRef.collection("blackboards").doc(newDocID).set({}),
        this.classDocRef.collection("rooms").add({
          roomTypeID: this.roomTypeDoc.id, 
          blackboards: [newDocID]
        })
      ]);
    },
    async clearRoomStatuses (roomType) {
      const querySnapshot = await db
        .collection(`classes/${this.classID}/rooms`)
        .where('roomTypeID', '==', this.roomTypeDoc.id)
        .get();

      for (const docSnapshot of querySnapshot.docs) {
        docSnapshot.ref.update({
          status: ""
        });
      }
    },
    showMakeAnnouncementPopup (roomType) {
      this.makeAnnouncementPopup = {
        show: true,
        roomType: roomType
      }
    },
    async makeAnnouncement (message, roomType) {      
      if (!message) {
        this.$root.$emit("show-snackbar", "Invalid announcement message");
        return;
      }
      
      const querySnapshot = await db
        .collection(`classes/${this.classID}/rooms`)
        .where("roomTypeID", '==', this.roomTypeDoc.id)
        .get();
      for (const docSnapshot of querySnapshot.docs) {
            // TODO: Change this to just writing uid
            // To do this, we need to provide a global way to get information
            // about a user from their uid. This is needed because the author
            // could disconnect after sending an announcement.
        docSnapshot.ref.update({
          announcement: {
            message: message,
            author: {
              firstName: this.user.firstName,
              lastName: this.user.lastName,
            }
          },
          announcementCounter: firebase.firestore.FieldValue.increment(1)
        });
      }
      this.$root.$emit("show-snackbar", "Announcement sent.");
      this.makeAnnouncementPopup['show'] = false;
    },
    async muteParticipantsInRooms () {
      this.roomTypeRef.update({
        muteAllCounter: firebase.firestore.FieldValue.increment(1)
      });
    },
     /**
     * Assigns all participants in rooms of roomType to a random room of
     * roomType. After shuffling, each room has at minimum minRoomSizeOnShuffle
     * participants.
     * */ 
    async shuffleParticipants (roomType) {
      /**
       * Shuffles array in place. ES6 version
       * @param {Array} a array containing items.
       * @see https://stackoverflow.com/a/6274381
       */
      function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }

      const targetRooms = this.rooms; 
  
      // Get all UIDs in rooms or roomType, no duplicates
      const targetUIDSet = new Set();
      for (const participant of this.participants) {
        targetUIDSet.add(participant.uid); 
      }
       
      const targetUIDs = Array.from(targetUIDSet);
      shuffle(targetUIDs); 
    
      // initialize roomAssignments
      const roomAssignments = [];
      for (const room of targetRooms) {
        if (room.isCommonRoom) continue; 
        roomAssignments.push({
          roomID: room.id,
          assignees: []
        });
      }
      
      for (const room of roomAssignments) {
        if (targetUIDs.length === 0) break; 
        while (room.assignees.length < this.groupSize) {
          if (targetUIDs.length === 0) break; 
          else room.assignees.push(targetUIDs.pop()); 
        }
      }

      // each connected user will detect the change and be redirected.
      this.roomTypeRef.update({
        roomAssignments: roomAssignments,
        roomAssignmentsCounter: firebase.firestore.FieldValue.increment(1)
      });
    }
  }
}
</script>

<style scoped>
.active-blackboard {
  position: relative;
  /* border-left: 1px solid var(--v-accent-base); */
}
</style>