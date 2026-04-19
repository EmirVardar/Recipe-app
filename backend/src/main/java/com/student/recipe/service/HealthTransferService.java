package com.student.recipe.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.health.HealthTransferRequestDto;
import com.student.recipe.dto.health.HealthTransferResponseDto;
import com.student.recipe.entity.HealthTransferRecord;
import com.student.recipe.repository.HealthTransferRecordRepository;

@Service
public class HealthTransferService {

    private final HealthTransferRecordRepository healthTransferRecordRepository;

    public HealthTransferService(HealthTransferRecordRepository healthTransferRecordRepository) {
        this.healthTransferRecordRepository = healthTransferRecordRepository;
    }

    @Transactional
    public HealthTransferResponseDto aktar(HealthTransferRequestDto request) {
        validateRequest(request);

        HealthTransferRecord record = new HealthTransferRecord();
        record.setAdim(request.adim());
        record.setKalori(request.kalori());

        HealthTransferRecord saved = healthTransferRecordRepository.save(record);

        return new HealthTransferResponseDto(
                true,
                saved.getId(),
                saved.getAdim(),
                saved.getKalori(),
                saved.getCreatedAt(),
                "Saglik verisi kaydedildi"
        );
    }

    @Transactional(readOnly = true)
    public List<HealthTransferResponseDto> getRecentRecords() {
        return healthTransferRecordRepository.findTop100ByOrderByCreatedAtDesc()
                .stream()
                .map(record -> new HealthTransferResponseDto(
                        true,
                        record.getId(),
                        record.getAdim(),
                        record.getKalori(),
                        record.getCreatedAt(),
                        "Saglik verisi listelendi"
                ))
                .toList();
    }

    private void validateRequest(HealthTransferRequestDto request) {
        if (request == null || request.adim() == null || request.kalori() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "adim ve kalori zorunludur");
        }
        if (request.adim() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "adim 0 veya daha buyuk olmalidir");
        }
        if (request.kalori() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "kalori 0 veya daha buyuk olmalidir");
        }
    }
}
