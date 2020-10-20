<template>
  <div>
    This is a video conference playground with the Jisti lower level API
  </div>
</template>

<script>
export default {
  created () {
    JitsiMeetJS.init();
    console.log("checkpoint 1, JitsiMeetJS =", JitsiMeetJS);
    const options = {
      hosts: {
          domain: 'jitsi-meet.example.com',
          muc: 'conference.jitsi-meet.example.com' // FIXME: use XEP-0030
      },
      bosh: '//jitsi-meet.example.com/http-bind', // FIXME: use xep-0156 for that

      // The name of client node advertised in XEP-0115 'c' stanza
      clientNode: 'http://jitsi.org/jitsimeet'
    };

    const confOptions = {
      openBridgeChannel: true
    };



    const connection = new JitsiMeetJS.JitsiConnection(null, null, options);

    // callbacks 
    const onConnectionSuccess = (param1) => {
      console.log("successfully connected, param1 =", param1);
    };
    const onConnectionFailed = (param1) => {
      console.log("failed to connect, param1 =", param1);
    }
    const disconnect = (param1) => {
      console.log("disconneted =", param1);
    }

    connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, onConnectionSuccess);
    connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, onConnectionFailed);
    connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED, disconnect);

    console.log("connection =", connection);

    // establish a connection to Jitsi
    connection.connect();
    console.log("checkpoint 2, connetion =", connection);
    

    const room = connection.initJitsiConference("conference1", confOptions);
    room.on(JitsiMeetJS.events.conference.TRACK_ADDED, onRemoteTrack);
    room.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, onConferenceJoined);

    JitsiMeetJS.createLocalTracks().then(onLocalTracks);

    room.join(); 
    console.log("checkpoint 3, room =", room);
  }
};
</script>