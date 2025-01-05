package main

import (
	"encoding/json"
	"fmt"
)

type SyncService struct{}

func (s *SyncService) Test() {
	b, err := json.MarshalIndent(ConfigInstance, "", "  ")
	if err != nil {
		fmt.Println("error:", err)
	}
	fmt.Print(string(b))
}
