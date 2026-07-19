# Performance Operations Spine Test Plan

## Application Overview

The Performance operational spine exposes contextual in-app notifications and tenant-safe file
attachments through the Fusion shell. Notifications are visible to the recipient only; attachment
authorization stays with the owning Performance feature, with `PerformanceCycle` as the proof
consumer. There is intentionally no generic owner-id attachment screen.

## Test Scenarios

### 1. Notification bell

**Seed:** `e2e/seed.spec.ts`

#### 1.1. should-poll-activate-and-deep-link-a-planning-reminder

**File:** `e2e/notification-bell.spec.ts`

**Steps:**
  1. Sign in through the shell as the Atlas HR/manager account.
    - expect: the Performance shell is reached and provides an authenticated bearer token.
  2. Record a planning reminder for an employee through the shell-origin Gateway route.
    - expect: the reminder is accepted and notification delivery is requested.
  3. Sign in through the shell as the recipient employee.
    - expect: the notification bell polls and reports at least one unread notification.
  4. Open the notification list.
    - expect: opening the list does not mark the reminder read.
    - expect: the planning-reminder title and unique message are visible.
  5. Activate the reminder.
    - expect: the reminder is marked read.
    - expect: navigation reaches the campaign completion workspace.
  6. Render the bell/list at desktop light and mobile dark sizes.
    - expect: the control remains visible, usable, and free of horizontal overflow.

### 2. Cycle attachments

**Seed:** `e2e/seed.spec.ts`

#### 2.1. should-upload-and-download-an-authorized-cycle-attachment

**File:** `e2e/cycle-attachments.spec.ts`

**Steps:**
  1. Sign in through the shell as a tenant cycle manager and select an existing cycle.
    - expect: an in-tenant cycle is available through the Gateway.
  2. Upload a small text attachment owned by that cycle.
    - expect: the attachment is committed with the expected owner, filename, and content type.
  3. Download the attachment with the same authorized account.
    - expect: the streamed bytes and download filename match the upload.
  4. Attempt an upload with an unsupported owner type.
    - expect: the request is denied before file storage.
