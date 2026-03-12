-- Migration: Add theme_preference column to users table
-- Persists each user's chosen light/dark mode preference in the DB.
-- Safe to run multiple times (IF NOT EXISTS guard).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark';
