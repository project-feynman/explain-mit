<template>
  <div style="display: flex">
    <div style="width: 300px;">
     <TheSideDrawerGroupByFolders v-if="mitClass"
        @post-was-clicked="postID => $store.commit('SET_CURRENTLY_SELECTED_LIBRARY_POST_ID', postID)"
      /> 
    </div>
    <!-- `flex-grow` lets the video take the remaining available space, see https://stackoverflow.com/questions/37745051/make-div-fill-remaining-horizontal-space-in-flexbox -->
    <div style="flex-grow: 1">
      <!-- TODO: inject the expl_prop into here  -->
      <ClassPageSeePost v-if="currentlySelectedLibraryPostID"
        :postID="currentlySelectedLibraryPostID"
        :key="currentlySelectedLibraryPostID"
      />
    </div>
  </div>
</template>

<script>
import TheSideDrawerFileExplorer from "@/components/TheSideDrawerFileExplorer.vue";
import TheSideDrawerGroupByDate from "@/components/TheSideDrawerGroupByDate.vue";
import TheSideDrawerGroupByFolders from "@/components/TheSideDrawerGroupByFolders.vue";
import ClassPageSeePost from "@/components/ClassPageSeePost.vue";
import { mapState } from "vuex"; 

export default {
  components: {
    TheSideDrawerFileExplorer,
    TheSideDrawerGroupByDate,
    TheSideDrawerGroupByFolders,
    ClassPageSeePost
  },
  computed: {
    ...mapState([
      "mitClass",
      "currentlySelectedLibraryPostID"
    ])
  }
}
</script>