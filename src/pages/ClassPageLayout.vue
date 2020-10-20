<template>
  <div style="height: 100%;">
    <v-app-bar :value="!isBoardFullscreen" app clipped-left color="white" outlined :style="`padding-left: ${24-12}px`">
      <v-app-bar-nav-icon @click="isShowingDrawer = !isShowingDrawer"></v-app-bar-nav-icon>

      <v-list-item-avatar @click="$router.push('/get-started')" tile :width="`${40+3}px`" style="cursor: pointer;" :style="`margin-right: ${16-3}px`">
        <img src="/logo.png">
      </v-list-item-avatar>
      
      <v-list-item-title v-if="mitClass" style="opacity: 100%; font-size: 1.45rem;">
        {{ mitClass.name }}
      </v-list-item-title>

      <v-spacer/>

      <!-- <GroupChat v-if="mitClass" class="mr-3"/> -->

      <!-- Library -->
      <v-dialog v-model="showLibrary" fullscreen>
        <template v-slot:activator="{ on, attrs }">
          <v-btn v-on="on" v-bind="attrs" color="white">
            <v-icon class="mr-2">mdi-bookshelf</v-icon>
            Library
          </v-btn>
        </template>

        <v-toolbar dark>
          <v-btn icon dark @click="showLibrary = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <ClassLibrary/>
      </v-dialog>
    </v-app-bar>

    <v-divider/>

    <v-navigation-drawer v-model="isShowingDrawer" app width="285" clipped touchless height="100%" mobile-breakpoint="500">      
      <portal-target name="side-drawer">

      </portal-target>

      <template v-slot:append>
        <portal-target name="side-drawer-bottom-region">

        </portal-target>
      </template>
    </v-navigation-drawer>

    <v-main style="overflow-x: auto; height: 100%;">
      <portal-target name="main-content" style="height: 100%;">
        
      </portal-target>
    </v-main>

    <!-- :key="...class_id" forces <router-view/> to re-render -->
    <!-- Many things from <router-view> will teleport to the portals above -->
    <router-view v-if="mitClass" :key="$route.params.class_id"/>
  </div>
</template>

<script>
import db from "@/database.js";
import firebase from "firebase/app";
import "firebase/firestore";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import { DefaultEmailSettings } from "@/CONSTANTS.js";
import { mapState } from "vuex";
import SmallAppBar from "@/components/SmallAppBar.vue"; 
import GroupChat from "@/components/GroupChat.vue"; 
import ClassLibrary from "@/pages/ClassLibrary.vue";

export default {
  name: "ClassPageTemplate",
  mixins: [
    DatabaseHelpersMixin
  ],
  components: {
    SmallAppBar,
    GroupChat,
    ClassLibrary
  },
  data: () => ({
    firebaseRef: null,
    classParticipantsRef: null,
    isChatOpen: false,
    isShowingDrawer: true,
    showLibrary: false
  }),
  computed: {
    ...mapState([
      "user",
      "mitClass",
      "isBoardFullscreen"
    ]),
    classID () {
      return this.$route.params.class_id;
    }
  },
  // TODO: refactor this quickfix
  watch: {
    isBoardFullscreen (newVal) {
      if (newVal) {
        this.isShowingDrawer = false; 
      } else {
        this.isShowingDrawer = true; 
      }
    }
  },
  created () {
    if (this.classID) {
      this.$store.commit("SET_CLASS", null); // otherwise the other class lingers for 1 second
      this.$store.dispatch("fetchClass", this.classID);  
    }
    db.doc(`users/${this.user.uid}`).update({
      mostRecentClassID: this.classID
    });
  },
  methods: {
    async submitBug ({ "Describe your problem": title }) {
      if (!title) {
        this.$root.$emit("show-snackbar", "Error: don't forget to write something")
        return;
      }
      const sendEmailToTeam = firebase.functions().httpsCallable("sendEmailToCoreTeam");
      sendEmailToTeam({ 
        userEmail: this.user ? this.user.email : "anonymous@mit.edu",
        userFeedback: title  
      });
      await db.collection("bugs").add({ 
        title,
        email: this.user ? this.user.email : "anonymous@mit.edu"
      }); 
      this.$root.$emit("show-snackbar", "Successfully sent feedback.");
    },
    async leaveClass () {
      const emailSettingsUpdate = {};
      for (let emailOption of Object.keys(DefaultEmailSettings)) {
        emailSettingsUpdate[emailOption] = firebase.firestore.FieldValue.arrayRemove(this.mitClass.id);
      }
      const updatedEnroll = this.user.enrolledClasses.filter((course) => course.id !== this.$route.params.class_id);
      await db.collection("users").doc(this.user.uid).update({
        enrolledClasses: updatedEnroll,
        ...emailSettingsUpdate
      });
      this.$router.push({ path: '/' });
      this.$root.$emit("show-snackbar", "Successfully dropped class.");
    }
  }
}
</script>

<style scoped>
/* Make the side-drawer vertically scrollable  */
html {
  overflow-y: auto; 
}
</style>