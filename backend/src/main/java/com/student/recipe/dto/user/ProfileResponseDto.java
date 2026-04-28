package com.student.recipe.dto.user;

public record ProfileResponseDto(
        Integer age,
        String sex,
        Double heightCm,
        Double weightKg,
        String activityLevel,
        String goal
) {
}
