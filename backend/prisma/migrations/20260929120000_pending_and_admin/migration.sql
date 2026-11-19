-- Provider accepts a booking request before it is confirmed
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING';

-- Admin can approve providers and see bookings
ALTER TYPE "Role" ADD VALUE 'ADMIN';
