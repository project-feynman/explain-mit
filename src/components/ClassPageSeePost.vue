<template>
  <div>
    <ExplanationDisplay v-if="originalPost" 
      :expl="originalPost"
      hasTitle
    />
    <ExplanationDisplay v-for="expl in sortedExplanations" 
      :expl="expl" 
      :key="expl.id"
    />
    <!-- <ExplanationCreate v-if="user" 
      explType="reply"
    /> -->
  </div>
</template>

<script>
import ExplanationCreate from "@/components/ExplanationCreate.vue";
import ExplanationDisplay from "@/components/ExplanationDisplay.vue";
import DatabaseHelpersMixin from "@/mixins/DatabaseHelpersMixin.js";
import db from "@/database.js";
import { mapState } from "vuex";

export default {
  props: {
    postID: {
      type: String,
      required: true
    }
  },
  mixins: [
    DatabaseHelpersMixin
  ],
  components: { 
    ExplanationCreate, 
    ExplanationDisplay,
  },
  data: () => ({
    originalPost: null,
    explanations: [],
    explanationsRef: null,
    postRef: null,
    databaseListeners: [],
  }),
  computed: {
    ...mapState([
      "user"
    ]),
    sortedExplanations () {
      return this.explanations.sort((a, b) => (a.date < b.date) ? -1 : ((a.date > b.date) ? 1 : 0));
    }
  },
  async created () {
    // const type = this.$route.query.type === 'question' ? 'questions' : 'posts';
    const type = "posts";
    const { class_id } = this.$route.params;
    console.log("ClassPageSeePost created(), postID =", this.postID);
    this.postRef = db.doc(`classes/${class_id}/${type}/${this.postID}`);
    this.explanationsRef = this.postRef.collection("explanations");

    this.$_listenToDoc(this.postRef, this, "originalPost").then(listener => {
      this.databaseListeners.push(listener);
    });
    this.$_listenToCollection(this.explanationsRef, this, "explanations").then(listener => {
      this.databaseListeners.push(listener);
    });
  },
  destroyed () { 
    for (const unsubscribeListener of this.databaseListeners) {
      unsubscribeListener();
    }
  }
}
</script>