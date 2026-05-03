package com.student.recipe.dto.user;

import java.time.LocalDate;

public record ProfileResponseDto(
        LocalDate birthDate,
        String sex,
        Double heightCm,
        Double weightKg,
        String activityLevel,
        String goal
) {
}
