package com.student.recipe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.health.HealthTransferRequestDto;
import com.student.recipe.dto.health.HealthTransferResponseDto;
import com.student.recipe.service.HealthTransferService;

@RestController
@RequestMapping("/api/saglik")
public class HealthTransferController {

    private final HealthTransferService healthTransferService;

    public HealthTransferController(HealthTransferService healthTransferService) {
        this.healthTransferService = healthTransferService;
    }

    @GetMapping("/kayitlar")
    public ResponseEntity<java.util.List<HealthTransferResponseDto>> kayitlar() {
        return ResponseEntity.ok(healthTransferService.getRecentRecords());
    }

    @PostMapping("/aktar")
    public ResponseEntity<HealthTransferResponseDto> aktar(@RequestBody HealthTransferRequestDto request) {
        return ResponseEntity.ok(healthTransferService.aktar(request));
    }
}
