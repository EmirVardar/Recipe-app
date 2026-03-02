package com.student.recipe.dto;

public record ProfileResponseDto(
        Integer age,
        String sex,
        Double heightCm,
        Double weightKg,
        String activityLevel,
        String goal
) {
}
