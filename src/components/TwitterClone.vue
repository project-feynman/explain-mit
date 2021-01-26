<template>
  <div>
    <h2>Newsfeed of tweets</h2>
    <p>tweetsFetchedFromDatabase: {{ tweetsFetchedFromDatabase }} </p>
    <template v-for="tweet in tweetsFetchedFromDatabase">
      <v-card
        class="mx-auto"
        max-width="344"
        outlined
      >
        <v-list-item three-line>
          <v-list-item-content>
            <div class="overline mb-4">
              <!-- OVERLINE -->
            </div>
            <v-list-item-title class="headline mb-1">
              <!-- Headline 5 -->
            </v-list-item-title>
            <v-list-item-subtitle>{{ tweet.content }}</v-list-item-subtitle>
          </v-list-item-content>

          <v-list-item-avatar
            tile
            size="80"
            color="grey"
          ></v-list-item-avatar>
        </v-list-item>

        <v-card-actions>
          <v-btn
            outlined
            rounded
            text
          >
            Button
          </v-btn>
        </v-card-actions>
      </v-card>



      <!-- <h5 :key="tweet.id">{{ tweet.content }}</h5> -->
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

export default {
  data () {
    return {
      tweetContent: "",
      tweetsFetchedFromDatabase: []
    }
  },
  async created () {
    // const tweetsRequest = await db.collection("tweets").get(); 
    // console.log("tweetsRequest =", tweetsRequest); 
    // for (const tweet of tweetsRequest.docs) {
    //   console.log("tweet.data() =", tweet.data());
    //   this.tweetsFetchedFromDatabase.push(tweet.data());

    // const fetchTweetsFromDB = 
    
    

    // }

    db.collection("tweets").onSnapshot(resultFromDatabase => {
      for (const tweetDoc of resultFromDatabase.docs) {
        console.log("tweetDoc =", tweetDoc);
        this.tweetsFetchedFromDatabase.push(tweetDoc.data());
      }
    });
    // var starCountRef = db.('posts/' + postId + '/starCount');
    // starCountRef.on('value', (snapshot) => {
    //   const data = snapshot.val();
    //   updateStarCount(postElement, data);
    // });



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


