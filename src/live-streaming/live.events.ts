export const LiveEvents = {
    START_LIVE: 'startLive',
    LIVE_STARTED: 'liveStarted',
    JOIN_LIVE: 'joinLive',
    USER_JOINED_LIVE: 'userJoinedLive',
    LEAVE_LIVE: 'leaveLive',
    USER_LEFT_LIVE: 'userLeftLive',
    END_LIVE: 'endLive',
    LIVE_ENDED: 'liveEnded',
    LIVE_MESSAGE: 'liveMessage',
    LIVE_ERROR: 'liveError',
    LIVE_ROOM_LIST: 'liveRoomList',
    GET_LIVE_ROOMS: 'getLiveRooms',

    // Guest co-host events
    REQUEST_JOIN_LIVE: 'requestJoinLive',         // Viewer -> Server: request to join as co-host
    JOIN_REQUEST_RECEIVED: 'joinRequestReceived', // Server -> Host: new join request
    APPROVE_GUEST: 'approveGuest',               // Host -> Server: approve a guest
    GUEST_APPROVED: 'guestApproved',             // Server -> Guest: you've been approved (with publisher token)
    REJECT_GUEST: 'rejectGuest',                 // Host -> Server: reject a guest
    GUEST_REJECTED: 'guestRejected',             // Server -> Guest: your request was rejected
    REMOVE_GUEST: 'removeGuest',                 // Host -> Server: remove co-host
    GUEST_REMOVED: 'guestRemoved',               // Server -> Room: a co-host was removed
    COHOST_JOINED: 'cohostJoined',               // Server -> Room: a new co-host is now publishing
} as const;
