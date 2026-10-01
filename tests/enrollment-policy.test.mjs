import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countEnrollmentsInCurrentMonth,
  getUnsubscribeDeadline,
  isEnrollmentAllowed,
  removeCourseEnrollment,
} from '../src/app/services/enrollmentPolicy.js';

test('defines unsubscription deadline as 3 days after enrollment date', () => {
  const date = '2026-10-01T09:00:00.000Z';
  assert.equal(getUnsubscribeDeadline(date), '2026-10-04T09:00:00.000Z');
});

test('counts enrollments only for the current month', () => {
  const enrollments = [
    { courseId: 1, enrolledAt: '2026-10-01T08:00:00.000Z' },
    { courseId: 2, enrolledAt: '2026-10-05T08:00:00.000Z' },
    { courseId: 3, enrolledAt: '2026-10-16T08:00:00.000Z' },
    { courseId: 9, enrolledAt: '2026-09-28T08:00:00.000Z' },
  ];

  assert.equal(countEnrollmentsInCurrentMonth(enrollments, new Date('2026-10-20T12:00:00.000Z')), 3);
});

test('blocks duplicate enrollment and monthly cap for personal registrations', () => {
  const enrollments = [
    { courseId: 1, enrolledAt: '2026-10-01T08:00:00.000Z' },
    { courseId: 2, enrolledAt: '2026-10-05T08:00:00.000Z' },
    { courseId: 3, enrolledAt: '2026-10-16T08:00:00.000Z' },
  ];

  assert.deepEqual(isEnrollmentAllowed(enrollments, 3, new Date('2026-10-20T12:00:00.000Z')), {
    allowed: false,
    reason: 'duplicate',
  });

  assert.deepEqual(isEnrollmentAllowed(enrollments, 99, new Date('2026-10-20T12:00:00.000Z')), {
    allowed: false,
    reason: 'monthly_limit',
  });
});

test('removes a course from the enrolled list after unsubscribe confirmation', () => {
  const enrollments = [
    { courseId: 1, enrolledAt: '2026-10-01T08:00:00.000Z' },
    { courseId: 2, enrolledAt: '2026-10-05T08:00:00.000Z' },
    { courseId: 3, enrolledAt: '2026-10-16T08:00:00.000Z' },
  ];

  assert.deepEqual(removeCourseEnrollment(enrollments, 2), [
    { courseId: 1, enrolledAt: '2026-10-01T08:00:00.000Z' },
    { courseId: 3, enrolledAt: '2026-10-16T08:00:00.000Z' },
  ]);
});
