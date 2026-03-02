package com.student.recipe.dto;

public record MedicalResponseDto(
        String chronicConditions,
        String medications,
        String allergies,
        String intolerances
) {
}
