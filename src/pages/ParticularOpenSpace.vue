<template>
  <portal v-if="roomTypeDoc" to="side-drawer">
    <v-card elevation="5">
    <v-list-item two-line style="padding-top: 0; padding-left: 10x">
      <v-btn @click="$router.push(`/class/${classID}`)" icon class="mr-2">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>

      <v-list-item-content>
        <v-list-item-title style="font-size: 1.15rem; opacity: 70%">
          {{ roomTypeDoc.name }}
        </v-list-item-title>
      </v-list-item-content>

      <!-- The triple dot dropdown menu with actions that affects the whole class -->
      <v-menu v-if="isAdmin" v-model="isMenuOpen" bottom nudge-left offset-y>
        <template v-slot:activator="{ on, attrs }">

        <BaseButton @click="isMenuOpen = true" icon="mdi-dots-vertical" color="black" small>
          Space actions
        </BaseButton>
        </template>

        <v-list>
          <v-list-item @click="showMakeAnnouncementPopup(roomTypeDoc.id)">
            <v-icon left color="blue">mdi-bullhorn</v-icon> Make announcement
          </v-list-item>

          <BasePopupButton>
            <template v-slot:activator-button="{ on, openPopup }">
              <v-list-item @click.stop="openPopup()">
                <v-icon left color="black">mdi-file-pdf</v-icon> Set problem
              </v-list-item>
            </template>
            <template v-slot:message-to-user>
              <p>If you upload a multi-paged PDF, each page will be seeded in sequence in every room. 
                For example, if you upload a PDF document with 5 problems, then every room's board #1 ~ #5 will be those problems. 
              </p>

              <v-row>
                <v-col>
                  Set PDF problem in every room's board # 
                </v-col>
                <v-col cols="12" sm="4">
                  <v-overflow-btn 
                    label="1"
                    :items="[1, 2, 3, 4, 5, 6, 7, 8]"
                    @change="newVal => targetBoardNum = (newVal - 1)"
                  />
                </v-col>
              </v-row>
            </template>
            <template v-slot:popup-content="{ closePopup }">
              <v-btn @click="$refs.fileInput.click()">Select file</v-btn>
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

          <v-list-item @click="muteParticipantsInRooms(roomTypeDoc.id)">
            <v-icon left>mdi-volume-mute</v-icon> Mute everyone
          </v-list-item>

          <BasePopupButton actionName="Shuffle everyone" @action-do="shuffleParticipants(roomTypeDoc.id)">
            <template v-slot:activator-button="{ on, openPopup }">
              <v-list-item @click.stop="openPopup()">
                <v-icon left color="black">mdi-shuffle-variant</v-icon> Shuffle everyone
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

          <!-- <v-list-item @click="clearRoomStatuses(roomTypeDoc.id)">
            <v-icon left color="red">mdi-comment-remove</v-icon> Reset statuses
          </v-list-item> -->

          <BasePopupButton actionName="Reset everything" @action-do="resetAbsolutelyEverything()">
            <template v-slot:activator-button="{ on, openPopup }">
              <v-list-item @click.stop="openPopup()">
                <v-icon left color="red">mdi-delete</v-icon> Reset everything
              </v-list-item>
            </template>
            <template v-slot:message-to-user>
              Are you sure you want to reset absolutely everything? 
              This will reset the blackboards and status of every single room. 
            </template> 
          </BasePopupButton>

          <!-- <v-list-item disabled>
            <v-icon left>mdi-music-clef-treble</v-icon> Set music
          </v-list-item> -->

          <v-list-item v-if="isAdmin && rooms.length !== 0" @click="createNewRoom()">
            <v-icon left>mdi-plus</v-icon> New room
          </v-list-item>
        </v-list>
      </v-menu>
    </v-list-item>
    </v-card>

    <v-divider/>

    <!-- COMMON ROOM (lots of quickfix code here)-->
    <v-list-item v-if="commonRoomDoc" :key="commonRoomDoc.id"
      :to="`/class/${classID}/section/${sectionID}/`"
      exact exact-active-class="active-blackboard accent--text"
    >
      <div class="py-5" style="width: 100%">
        <div class="d-flex">
          <div class="font-weight-medium py-2" :class="$route.params.room_id ? 'text--secondary' : ''" style="font-size: 0.75em">
            COMMON ROOM
          </div>
          <v-spacer/>
          <portal-target v-if="!currentRoomID" name="current-room-buttons">
        
          </portal-target>
        </div>      

        <template v-if="!currentRoomID">
          <div class="pl-3">
            <p v-for="p in roomIDToParticipants[sectionID]" :key="p.id"
              style="font-weight: 400; font-size: 0.8em"
              :class="`text--secondary mb-0 d-flex ${ `${p.firstName} ${p.lastName}` === dominantSpeaker.name ? 'font-weight-black' : ''}`"
            >
              {{ p.firstName + " " + p.lastName }}
              <v-spacer/>
              {{ "#" + p.currentBoardNumber }} 
              <v-icon small class="mx-2" :color="p.canHearAudio ? 'green' : 'red'">
                {{ p.canHearAudio ? "mdi-phone-check" : "mdi-phone-off" }}
              </v-icon>
            </p>
          </div>

          <!-- The below is now useless -->
          <portal-target  name="current-room-participants">

          </portal-target>
        </template>

        <!-- Quickfix  -->
        <div v-else style="width: 100%;">
          <div class="d-flex">

            <v-spacer/>

            <v-chip v-if="commonRoomDoc.status" color="blue" outlined small>
            {{ commonRoomDoc.status }}
            </v-chip>
          </div>

          <div class="pl-3">
            <p v-for="p in roomIDToParticipants[commonRoomDoc.id]" :key="p.id"
              style="font-weight: 400; font-size: 0.8em"
              :class="`d-flex text--secondary mb-0 ${ `${p.firstName} ${p.lastName}` === dominantSpeaker.name ? 'font-weight-black' : ''}`"
            >
              {{ p.firstName + " " + p.lastName }}
              <v-spacer/>
              {{ "#" + p.currentBoardNumber }} 
              <v-icon small class="mx-2" :color="p.canHearAudio ? 'green' : 'red'">
                {{ p.canHearAudio ? "mdi-phone-check" : "mdi-phone-off" }}
              </v-icon>
            </p>
          </div>
        </div>
      </div>
    </v-list-item> 

    <!-- NON-COMMON ROOMS -->
     <v-list-item v-for="(room, i) in nonCommonRooms" :key="room.id"
      :to="`/class/${classID}/section/${sectionID}/room/${room.id}`"
      active-class="active-blackboard accent--text"
    >
      <!-- CASE 1: I'm in the room -->
      <template v-if="room.id === currentRoomID">
        <div class="py-5" style="width: 100%">
          <div class="d-flex">
            <div v-if="room.name" class="text-uppercase font-weight-medium py-2" style="font-size: 0.75em">
              {{ room.name }}
            </div>

            <div v-else class="text-uppercase font-weight-medium py-2" style="font-size: 0.75em">
              Room {{ i + 1 }}
            </div>

            <v-spacer/>
            <portal-target name="current-room-buttons">
          
            </portal-target>
          </div>

          <div class="d-flex">
            <v-chip v-if="room.status" color="blue" class="mt-3" small outlined>
              {{ room.status }}
            </v-chip>

            <v-spacer/>
          </div>

          <!-- TODO: display speakers as usual but just highlight them / add mute status --> 
          <!-- Keep track of an updated data structure storing the mute status of each participant -->
          <div class="pl-3">
            <p v-for="p in roomIDToParticipants[room.id]" :key="p.id"
              style="font-weight: 400; font-size: 0.8em"
              :class="`text--secondary mb-0 d-flex ${ `${p.firstName} ${p.lastName}` === dominantSpeaker.name ? 'font-weight-black' : ''}`"
            >
              {{ p.firstName + " " + p.lastName }}
              <v-spacer/>
              {{ "#" + p.currentBoardNumber }} 
              <v-icon small class="mx-2" :color="p.canHearAudio ? 'green' : 'red'">
                {{ p.canHearAudio ? "mdi-phone-check" : "mdi-phone-off" }}
              </v-icon>
            </p>
          </div>
          
          <!-- Now useless -->
          <portal-target name="current-room-participants">
            
          </portal-target>
        </div>
      </template>

      <!-- CASE 2: I'm not in the room-->
      <template v-else>
        <div style="width: 100%;">
          <div class="d-flex">
            <div v-if="room.name" class="text-uppercase font-weight-medium text--secondary py-1" style="font-size: 0.75em">
              {{ room.name }}
            </div>

            <div v-else class="text-uppercase font-weight-medium text--secondary py-1" style="font-size: 0.75em">
              Room {{ i+1 }}
            </div>
            <v-spacer/>

            <v-chip v-if="room.status" color="blue" outlined small>
            {{ room.status }}
            </v-chip>
          </div>

          <div class="pl-3">
            <p v-for="p in roomIDToParticipants[room.id]" :key="p.id"
              style="font-weight: 400; font-size: 0.8em"
              class="text--secondary mb-0 d-flex"
            >
              {{ p.firstName + " " + p.lastName }}
              <v-spacer/>
              {{ "#" + p.currentBoardNumber }} 
              <v-icon small class="mx-2" :color="p.canHearAudio ? 'green' : 'red'">
                {{ p.canHearAudio ? "mdi-phone-check" : "mdi-phone-off" }}
              </v-icon>
            </p>
          </div>
        </div>
      </template>
    </v-list-item>   

    <!-- Twilio Room with Collaborative Blackboard -->
    <portal to="main-content">
      <router-view :key="$route.params.section_id + $route.params.room_id"/>
    </portal>
    
    <!-- TODO: Refactor into TwilioRoom -->
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

    <!-- CONTROL DASHBOARD -->
    <portal to="side-drawer-bottom-region">
      <v-card color="grey darken-1"  >
        <v-card-title class="mb-0 pb-0 white--text">
          {{ user.firstName + " " + user.lastName }}
        </v-card-title>

        <v-card-text>
          <!-- User mute/deafen/etc. buttons -->
          <portal-target name="destination2">

          </portal-target>
        </v-card-text>
      </v-card>
    </portal>
  </portal>
</template>

<script>
import db from "@/database.js";
import { getRandomId } from "@/helpers.js";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import { mapState, mapGetters } from "vuex"; 
import BaseButton from "@/components/BaseButton.vue";
import BasePopupButton from "@/components/BasePopupButton.vue";
import HandleAnnouncements from "@/components/HandleAnnouncements.vue"; 
import SmallAppBar from "@/components/SmallAppBar.vue";
import firebase from "firebase/app";
import "firebase/firestore"; 
import "firebase/functions";
import ClassLibrary from "@/pages/ClassLibrary.vue";
import _ from "lodash"; 

export default {
  name: "ParticularOpenSpace",
  mixins: [
    DatabaseHelpersMixin
  ],
  components: {
    SmallAppBar,
    BaseButton,
    BasePopupButton,
    HandleAnnouncements,
    ClassLibrary
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
      incrementKeyToDestroy: 0
    }
  },
  computed: {
    ...mapState([
      "user",
      "mitClass",
      "session",
      "dominantSpeaker"
    ]),
    ...mapGetters([
      "isAdmin"
    ]),
    classID () {
      return this.$route.params.class_id; 
    },
    sessionID () {
      return this.session.currentID;
    },
    sectionID () {
      return this.$route.params.section_id;
    },
    nonCommonRooms () {
      return this.rooms.filter(room => !room.isCommonRoom)
    },
    isInRoom () { 
      return "room_id" in this.$route.params; 
    },
    currentRoomID () {
      return this.$route.params.room_id;
    },
    commonRoomDoc () {
      for (const room of this.rooms) {
        if (room.isCommonRoom) {
          return room; 
        }
      }
    },
    currentRoomDoc () {
      // previous added because <HandleAnnouncements> requires 
      // a :currentRoom prop, but that prop would be undefined 
      // because `currentRoomID` is undefined when the user is in the common room. 
    
      if (!this.currentRoomID) return this.commonRoomDoc; 

      for (const room of this.rooms) {
        if (room.id === this.currentRoomID) {
          return room; 
        }
      }
    },
    classDocRef () {
      return db.doc(`classes/${this.classID}`);
    },
    roomTypeRef () {
      return this.classDocRef.collection("roomTypes").doc(this.$route.params.section_id); 
    }
  },
  watch: {
    // whenever participants or rooms change (usually participants), we re-compute the entire
    // `roomIDToParticipants` array, but debounce with Lodash so it does not cause lag issues
    participants: {
      immediate: true,
      handler: _.debounce(function () {
        this.updateRoomIDToParticipants();
      }, 500)
    },
    rooms: {
      immediate: true,
      handler: _.debounce(function () {
        this.updateRoomIDToParticipants();
      }, 500)
    },
    "roomTypeDoc.roomAssignmentsCounter" (newVal, oldVal) {
      if (oldVal && oldVal !== newVal) {
        // don't shuffle instructors
        if (this.isAdmin) return; 

        for (const roomAssignment of this.roomTypeDoc.roomAssignments) {
          if (roomAssignment.assignees.includes(this.user.uid)) {
            if (this.currentRoomID !== roomAssignment.roomID) {
              this.$router.push(`/class/${this.classID}/section/${this.$route.params.section_id}/room/${roomAssignment.roomID}`);
              this.$root.$emit("show-snackbar", "You have been put in random room with other people. Have fun :)"); 
            }
          }
        }
      }
    },
    "roomTypeDoc.muteAllCounter" (newVal, oldVal) {
      if (oldVal && oldVal !== newVal) {
        this.$store.commit("SET_IS_MIC_ON", false);
        this.$root.$emit("show-snackbar", "An admin muted everyone"); 
      }
    },
    // Performance-wise, hopefully it's just a pointer 
    roomIDToParticipants (newVal) {
      this.$store.commit("SET_ROOM_ID_TO_PARTICIPANTS", newVal); 
    }
  },
  async created () {
    this.$_listenToDoc(this.roomTypeRef, this, "roomTypeDoc")
      .then(unsubFunc => this.unsubFuncs.push(unsubFunc));

    // listen to rooms 
    this.unsubFuncs.push(
      this.$_bindVarToDB({
        varName: "rooms",
        dbRef: this.classDocRef.collection("rooms").where("roomTypeID", "==", this.$route.params.section_id),
        component: this
      })
    );

    // listen to section participants
    this.unsubFuncs.push(
      this.$_bindVarToDB({
        varName: "participants",
        dbRef: this.classDocRef.collection("participants").where("roomTypeID", "==", this.$route.params.section_id),
        component: this
      })
    );
  },
  beforeDestroy () {
    for (const unsubFunc of this.unsubFuncs) {
      unsubFunc(); 
    }
  },
  methods: {
    updateRoomIDToParticipants () {
      console.log("updateParticipants()")
      const out = {};
      for (const room of this.rooms) {
        const peopleInRoom = this.participants.filter(p => p.currentRoom === room.id); 
        peopleInRoom.sort((p1, p2) => {
          if (p1.canHearAudio === p2.canHearAudio) {
            return p2.currentBoardNumber - p1.currentBoardNumber;
          } else {
            return p2.canHearAudio - p1.canHearAudio; 
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
            db.doc(`${boardDbPath}`).update({ backgroundImageDownloadURL: "" })
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

      const promises = []; 
      for (const [i, imageFile] of imageFiles.entries()) {
        console.log("processing image number ", i);
        const processOneImage = this.$_saveToStorage(getRandomId(), imageFile).then(downloadURL => {
          const idx = this.targetBoardNum + i; 
          for (const room of this.rooms) {
            console.log("placing image number ", i, "into a room");
            if (room.blackboards.length <= idx) {
              break;
            } 
            const ref = this.classDocRef.collection("blackboards").doc(room.blackboards[idx]);
            promises.push(
              ref.update({
                backgroundImageDownloadURL: downloadURL
              })
            );
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
      ])
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
    /**
     * Mutes all participants in rooms of roomType
     * Does this by incrementing a counter in each targeted room.
     * This counter is watched by participants inside the rooms.
     * TODO: Can be refactored such that there is a single counter for each
     *       roomType and participants all watch the roomType counter.
     * */
    async muteParticipantsInRooms(roomType) {
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