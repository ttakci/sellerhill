-- PostgreSQL Initialization Script
-- This script runs when the container is first created
-- All table creation is handled by the application migration system

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
