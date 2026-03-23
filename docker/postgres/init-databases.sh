#!/bin/bash
set -e

echo "Creating databases for EY HR Platform services..."

psql -v ON_ERROR_STOP=1 --username $POSTGRES_USER --dbname postgres <<-EOSQL
    CREATE DATABASE fusion_identity;
    CREATE DATABASE fusion_training;
    CREATE DATABASE fusion_corehr;
    
    GRANT ALL PRIVILEGES ON DATABASE fusion_identity TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE fusion_training TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE fusion_corehr TO $POSTGRES_USER;
EOSQL

echo "Databases created successfully"