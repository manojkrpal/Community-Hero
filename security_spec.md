# Security Specification & Test-Driven Design (TDD) for Firestore

## 1. Data Invariants
- An issue must contain a non-empty `title` (max 200 chars), `description` (max 5000 chars), and a valid `category`.
- `severity` must be one of "Low", "Medium", "High", or "Critical".
- `latitude` and `longitude` must be valid numbers representing geolocations.
- `reporterId` and `reporterName` must be present.
- `status` must be a valid status string.

## 2. The "Dirty Dozen" Payloads
These payloads attempt to bypass database boundaries and must result in `PERMISSION_DENIED`.

1. **Payload 1: Empty Title**
   - Attempt to create an issue with `title: ""` or missing `title`.
2. **Payload 2: Title Too Long**
   - Attempt to write a title of over 200 characters.
3. **Payload 3: Empty Description**
   - Attempt to create an issue with `description: ""`.
4. **Payload 4: Invalid Severity**
   - Severity set to "Ultra" or an arbitrary string.
5. **Payload 5: Invalid Coordinates (Latitude Type)**
   - Latitude passed as a string rather than a float/integer.
6. **Payload 6: Invalid Coordinates (Longitude Type)**
   - Longitude passed as an array/object.
7. **Payload 7: Missing Reporter ID**
   - Reporter ID omitted.
8. **Payload 8: Missing Reporter Name**
   - Reporter Name omitted.
9. **Payload 9: Injection of Arbitrary System Fields**
   - Attempt to inject hidden admin control flags.
10. **Payload 10: Status Field Type Mismatch**
    - Status field passed as integer instead of string.
11. **Payload 11: Address Field Missing**
    - Address field omitted.
12. **Payload 12: Description Too Large**
    - Description larger than 5000 characters.

## 3. Test Runner Definition
`firestore.rules.test.ts` outlines our validation checks to assert that all dirty payloads are rejected.
