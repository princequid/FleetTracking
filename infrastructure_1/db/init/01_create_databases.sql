-- ============================================================================
-- FleetTrack Pro — Schema Initialization Script (Supabase / single-DB version)
-- ============================================================================
-- Supabase (and most managed Postgres free tiers) provide ONE database per
-- project — they do not support CREATE DATABASE for additional databases.
--
-- This is NOT a blocker: PostgreSQL schemas provide the same logical
-- separation within a single database. Each microservice gets its own
-- schema instead of its own database. All 9 services connect to the SAME
-- Supabase connection string, but each service's Flyway migrations and
-- JPA entities target ONLY their own schema.
--
-- Run this once against your Supabase database (via the SQL Editor in the
-- Supabase dashboard, or via psql using the connection string from
-- Project Settings → Database).
-- ============================================================================
 

-- M1 — Auth & Infrastructure
CREATE SCHEMA IF NOT EXISTS auth;
 
-- M1 — Core Records
CREATE SCHEMA IF NOT EXISTS driver;
CREATE SCHEMA IF NOT EXISTS vehicle;
 
-- M2 — Trip & GPS Tracking
CREATE SCHEMA IF NOT EXISTS trip;
CREATE SCHEMA IF NOT EXISTS gps;
 
-- M3 — Cargo Safety & Media
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS incident;
 
-- M5 — DevOps, Notifications & Integration
CREATE SCHEMA IF NOT EXISTS notif;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;
  