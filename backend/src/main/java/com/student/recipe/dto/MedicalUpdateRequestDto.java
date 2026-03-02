package com.student.recipe.dto;

public record MedicalUpdateRequestDto(
        String chronicConditions,
        String medications,
        String allergies,
        String intolerances
) {
}
