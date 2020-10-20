<template>
  <div>
    <template v-if="!isUsingJisti">
      
    </template>

    
    <portal to="destination2">
      <template v-if="!isUsingJisti">
        <p class="yellow--text">Only connected to the blackboard</p>
        <v-btn @click="connectToJisti()" block color="green" class="white--text mb-4">
          Join video room
        </v-btn>
        <VideoConferenceRoomTroubleshootPopup/>
      </template>

      <template v-else-if="!isConnectedToJitsi && isUsingJisti">
        <p class="yellow--text">Connecting...</p>
        <VideoConferenceRoomTroubleshootPopup/>
      </template>

      <template v-else>
        <p class="green--text mt-1 mb-1">Connected to video room</p>
        <p class="white--text">(The buttons that used to be here are now above the blackboard)</p>
        <VideoConferenceRoomTroubleshootPopup/>
      </template>
    </portal>

    <div v-if="isUsingJisti"
      id="jisti-video-conference" 
      :style="`height: ${isCommonRoom ? '70vh' : '300px'}`"
    >

    </div>
  </div>
</template>

<script>
import { mapState } from "vuex"; 
import VideoConferenceRoomTroubleshootPopup from "@/components/VideoConferenceRoomTroubleshootPopup.vue";

export default {
  props: {
    roomID: {
      type: String,
      required: true
    },
    isCommonRoom: {
      type: Boolean,
      required: true
    }
  },
  components: {
    VideoConferenceRoomTroubleshootPopup
  },
  data () {
    return {
      api: null,
      isUsingJisti: false,
      isConnectedToJitsi: false
    };
  },
  computed: {
    ...mapState(["user", "canHearAudio"])
  },
  mounted () {
    // TODO: rename `canHearAudio` to `hasJoinedAVRoomAlready`
    if (this.canHearAudio) {
      this.connectToJisti(); 
    }
  },
  methods: {
    async connectToJisti () {
      this.$store.commit("SET_CAN_HEAR_AUDIO", true);
      this.isUsingJisti = true; 
      await this.$nextTick(); // otherwise the API mounting fails 
      const domain = 'meet.jit.si'; 
      const options = {
        parentNode: document.querySelector("#jisti-video-conference"),
        roomName: this.roomID,
        userInfo: {
          displayName: `${this.user.firstName} ${this.user.lastName} `,
          id: this.user.uid
        },
        configOverwrite: {
          enableWelcomePage: false,
          // lower the bandwidth
          // constraints: {
          //   video: {
          //     height: {
          //       ideal: 480,
          //       max: 720,
          //       min: 240
          //     }
          //   }
          // }
        },
        interfaceConfigOverwrite: {
          // hide misleading steps in connecting
          MOBILE_APP_PROMO: false, // don't mislead the user to download an app
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          // clean up other UI clutter related to promos and branding
          SHOW_JITSI_WATERMARK: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
          // APP_NAME: "Video Comms",
          // configure UI for displaying videos
          // VERTICAL_FILMSTRIP: false,
          // VERTICAL_FILMSTRIP: this.isCommonRoom,
          // filmStripOnly: !this.isCommonRoom,
          // TILE_VIEW_MAX_COLUMNS: 5,
          // simplify UI by removing unnecessary features
          HIDE_INVITE_MORE_HEADER: true,
          SETTINGS_SECTIONS: [ 'devices', 'moderator'],
          TOOLBAR_BUTTONS: this.isCommonRoom ? [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'etherpad', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'stats',
            'tileview', 'download', 'mute-everyone', 
          ] 
          : 
          [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'chat',
            'settings', 'videoquality', 'filmstrip',
            'tileview', 'mute-everyone', 
          ]
        },
        // events here
        // seems to only fire when the user joins a video conference =
        onload: (argument) => {
          console.log("argument =", argument);
          this.isConnectedToJitsi = true; 
        }
      }; 
      this.api = new JitsiMeetExternalAPI(domain, options);
      this.api.addEventListener("videoConferenceLeft", roomName => {
        this.isUsingJisti = false;
        this.$store.commit("SET_CAN_HEAR_AUDIO", false);
        this.$store.commit("SET_DOMINANT_SPEAKER_NAME", "");
      });
      this.api.addEventListener("dominantSpeakerChanged", (dominantSpeaker) => {
        console.log("dominantSpeaker =", dominantSpeaker);
        this.$store.commit("SET_DOMINANT_SPEAKER_NAME", this.api.getDisplayName(dominantSpeaker.id));
      });
      this.api.addEventListener("audioMuteStatusChanged", muted => {
        console.log("muted ", muted);
      });
    }
  }
};
</script>