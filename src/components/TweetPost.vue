<template>  
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
        <v-list-item-subtitle>{{ tweetData.content }}</v-list-item-subtitle>
      </v-list-item-content>

      <v-list-item-avatar
        tile
        size="80"
        color="grey"
      ></v-list-item-avatar>
    </v-list-item>


    <v-card-actions>
      <GeneralButton @click="shareTweet()">
        Share
      </GeneralButton> 
      <GeneralButton @click="retweet()"
        >Retweet 
      </GeneralButton> 
      <GeneralButton>Delete</GeneralButton> 
      <GeneralButton>Flag</GeneralButton> 
    </v-card-actions>
  </v-card>
</template>

<script>
import db from "@/database.js";

import GeneralButton from "@/components/GeneralButton.vue"; 

export default {
  components: {
    GeneralButton
  },
  props: {
    tweetData: {
      type: Object,
      required: true
    }
  },
  methods: {
    // duplicates for now
    shareTweet () {
      db.collection("tweets").add({
        content: this.tweetData.content
      });
    },
    retweet () {

    }
  }
}
</script>