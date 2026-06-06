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
        TodayHealthStats stats = getTodayHealthStats();
        if (stats == null) {
            return "";
        }

        return String.format("""
        === BUGÜNKÜ SAĞLIK ÖZETİ ===
        Adım sayısı: %d
        Yakılan aktif kalori: %.0f kcal
        """,
                stats.steps(),
                stats.burnedCalories()
        );
    }

    @Transactional(readOnly = true)
    public TodayHealthStats getTodayHealthStats() {
        try {
            HealthTransferRecord healthRecord = healthTransferRecordRepository
                    .findTopByDateOrderByIdDesc(LocalDate.now())
                    .orElse(null);

            if (healthRecord == null) {
                return null;
            }

            return new TodayHealthStats(
                    healthRecord.getAdim() != null ? healthRecord.getAdim() : 0,
                    healthRecord.getKalori() != null ? healthRecord.getKalori() : 0.0
            );
        } catch (Exception e) {
            return null;
        }
    }

    public record TodayHealthStats(
            int steps,
            double burnedCalories
    ) {
    }
}
