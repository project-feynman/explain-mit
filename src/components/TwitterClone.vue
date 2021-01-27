<template>
  <div>
    <h2>Newsfeed of tweets</h2>
    <p>tweetsFetchedFromDatabase: {{ tweetsFetchedFromDatabase }} </p>
    <template v-for="tweet in tweetsFetchedFromDatabase">
      <TweetPost :tweetData="tweet" :key="tweet"/> 
    </template> 

    <v-textarea
      name="input-7-1"
      label="Default style"
      v-model="tweetContent"
      hint="Hint text"
    ></v-textarea>
    <v-btn @click="createTweetOnDatabase()">Create tweet</v-btn>
  </div>
</template>

<script>
import db from "@/database.js";
import TweetPost from "@/components/TweetPost.vue";

export default {
  components: {
    TweetPost
  },
  data () {
    return {
      tweetContent: "",
      tweetsFetchedFromDatabase: []
    }
  },
  async created () {
    db.collection("tweets").onSnapshot(resultFromDatabase => {
      this.tweetsFetchedFromDatabase = []; 
      for (const tweetDoc of resultFromDatabase.docs) {
        console.log("tweetDoc =", tweetDoc);
        this.tweetsFetchedFromDatabase.push(tweetDoc.data());
      }
    });
  },
  methods: {
    createTweetOnDatabase () {
      console.log("what I typed=", this.tweetContent);
      db.collection("tweets").add({
        content: this.tweetContent
      })
    }
  }
}
</script>


