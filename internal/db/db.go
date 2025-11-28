package db

import (
	"database/sql"
	_ "embed"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

func Open(path string) (*sql.DB, error) {
	return sql.Open("sqlite", path)
}

func Init(db *sql.DB) error {
	_, err := db.Exec(schemaSQL)
	return err
}
