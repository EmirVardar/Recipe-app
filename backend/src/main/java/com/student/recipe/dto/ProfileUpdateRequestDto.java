package com.student.recipe.dto;

public record ProfileUpdateRequestDto(
        Integer age,
        String sex,
        Double heightCm,
        Double weightKg,
        String activityLevel,
        String goal
) {
}
