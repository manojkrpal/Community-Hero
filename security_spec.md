# Security Spec: Community Hero Chat

## Data Invariants
1. A conversation must have at least one participant.
2. A chat message must belong to a valid conversation.
3. Users can only read conversations they are a participant in.
4. Users can only write messages to conversations they are a participant in.

## The "Dirty Dozen" Payloads
1. Create a conversation without any participants. (Should be denied)
2. Create a message in a conversation the user is not a participant in. (Should be denied)
3. Update another user's message. (Should be denied)
4. Delete a conversation the user is not a participant in. (Should be denied)
5. Read messages from a conversation the user is not a participant in. (Should be denied)
6. Create a message with an invalid ID. (Should be denied)
7. Create a message with an invalid timestamp (future/past). (Should be denied)
8. Update conversation participants without authorization. (Should be denied)
9. Create a message as another user. (Should be denied)
10. Read a conversation as an unauthenticated user. (Should be denied)
11. Write a message as an unauthenticated user. (Should be denied)
12. Create a message with a 10MB text field. (Should be denied)

## Test Runner
// Placeholder for firestore.rules.test.ts
