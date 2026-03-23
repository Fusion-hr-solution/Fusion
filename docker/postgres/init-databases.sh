#!/bin/bash
# ==============================================================================
# PostgreSQL Initialization Script
# ==============================================================================
# This script runs once when the PostgreSQL container is first created.
# It creates separate databases for each backend service.
# ==============================================================================

set -e

echo "Creating databases for EY HR Platform services..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    -- Create databases for each service
    CREATE DATABASE fusion_identity;
    CREATE DATABASE fusion_training;
    CREATE DATABASE fusion_corehr;

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE fusion_identity TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE fusion_training TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE fusion_corehr TO $POSTGRES_USER;
EOSQL

echo "Databases created successfully:"
echo "  - fusion_identity"
echo "  - fusion_training"
echo "  - fusion_corehr"
