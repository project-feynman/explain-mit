import Vue from "vue";
import Router from "vue-router";
import store from "@/store.js"; 
import firebase from "firebase/app";
import "firebase/auth";

Vue.use(Router);

const router = new Router({
  mode: "history",
  base: process.env.BASE_URL,
  routes: [
    { 
      name: "HomePage",
      path: "/",
      component: () => import(/* webpackChunkName: "home" */ "./pages/Home.vue")
    },
    {
      path: "/get-started",
      component: () => import(/* webpackChunkName: "home" */ "./pages/GetStarted.vue")
    },
    {
      path: "/explanation/:expl_id/class/:class_id",
      component: () => import(/* webpackChunkName: "home" */ "./components/ClassPageSeePost.vue"),
      props: route => {
        return { 
          postID: route.params.expl_id
        };
      }
    },
    {
      path: "/intersection-api-playground",
      component: () => import(/* webpackChunkName: "home" */ "./pages/IntersectionAPIPlayground.vue")
    },
    {
      path: "/canvas-playground",
      component: () => import(/* webpackChunkName: "home" */ "./pages/CanvasPlayground.vue")
    },
    {
      path: "/library-playground",
      component: () => import(/* webpackChunkName: "home" */ "./pages/LibraryPlayground.vue")
    },
    {
      path: "/jitsi-playground",
      component: () => import(/* webpackChunkName: "home" */ "./pages/JitsiPlayground3.vue")
    },
    {
      path: "/class/:class_id",
      component: () => import(/* webpackChunkName: "class-page-layout" */ "./pages/ClassPageLayout.vue"),
      children: [
        {
          path: "",
          component: () => import(/* webpackChunkName: "all-open-spaces" */ "./pages/AllOpenSpaces.vue") 
        },
        {
          path: "section/:section_id",
          component: () => import(/* webpackChunkName: "particular-open-space" */ "./pages/ParticularOpenSpace.vue"),
          children: [
            {
              path: "",
              component: () => import(/* webpackChunkName: "common-room" */ "./pages/CommonRoom.vue")
            },
            {
              path: "room/:room_id",
              component: () => import(/* webpackChunkName: "realtime-room" */ "./pages/RealtimeRoom.vue"),
              props: route => {
                return {
                  roomId: route.params.room_id
                };
              }
            }
          ]
        },
        // {
        //   // when /user/:id/posts is matched
        //   path: "new",
        //   // component: () => import(/* webpackChunkName: "new" */ "./pages/ClassPageNewPost.vue") 
        //   // move from components folder to pages folder later
        //   component: () => import(/* webpackChunkName: "new" */ "./components/ExplanationCreate.vue"),
        //   props: route => {
        //     // if it's a new post/question, the query type will be "post" or "question"
        //     return {
        //       explType: route.query.type ? "post" : "reply" 
        //     };  
        //   }
        // },
        // {
        //   path: "posts/:post_id",
        //   component: () => import(/* webpackChunkName: "post" */ "./pages/ClassPageSeePost.vue")
        // },
        // {
        //   path: "questions/:question_id",
        //   component: () => import(/* webpackChunkName: "question" */ "./pages/ClassPageSeeQuestion.vue")
        // }
      ]
    }
  ]
});

/**
 * Checks from Firebase auth whether the user exists or not. 
 * If user isn't logged in, sets `state.user` to null. 
 * Otherwise, populates `state.user` with the full Firestore mirror doc. 
 */
async function fetchUserInfo () {
  return new Promise(resolve => {
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        // necessary to handle if the user logs out
        store.commit("SET_USER", null);
      } 
      else {
        try {
          await store.dispatch("fetchUser", { uid: user.uid });
        } catch (error) {
          // TODO: still some unexplained behavior for authentication
          console.log("Cannot find user's mirror doc on Firestore");
          store.commit("SET_USER", null);
        }
      }
      store.commit("SET_HAS_FETCHED_USER_INFO", true); 
      resolve(); 
    });
  }); 
}

router.beforeEach(async (to, from, next) => {
  if (!store.state.hasFetchedUserInfo) {
    await fetchUserInfo(); 
  }
  if (to.name !== "HomePage" && !store.state.user) {
    next({ name: "HomePage" });
  } else {
    next(); 
  }
});

export default router;

