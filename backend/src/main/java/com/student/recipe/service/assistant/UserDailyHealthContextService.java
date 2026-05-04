package com.student.recipe.service.assistant;

import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.student.recipe.entity.HealthTransferRecord;
import com.student.recipe.repository.HealthTransferRecordRepository;

@Service
public class UserDailyHealthContextService {

    private final HealthTransferRecordRepository healthTransferRecordRepository;

    public UserDailyHealthContextService(HealthTransferRecordRepository healthTransferRecordRepository) {
        this.healthTransferRecordRepository = healthTransferRecordRepository;
    }

    @Transactional(readOnly = true)
    public String buildTodayHealthSummary() {
        try {
            HealthTransferRecord healthRecord = healthTransferRecordRepository
                    .findTopByDateOrderByIdDesc(LocalDate.now())
                    .orElse(null);

            if (healthRecord == null) {
                return "";
            }

            return String.format("""
                    === TODAY'S HEALTH SUMMARY ===
                    Steps: %d
                    Active calories burned: %.0f kcal
                    """,
                    healthRecord.getAdim() != null ? healthRecord.getAdim() : 0,
                    healthRecord.getKalori() != null ? healthRecord.getKalori() : 0.0
            );
        } catch (Exception e) {
            return "";
        }
    }
}
