package com.student.recipe.dto.user;

public record MedicalResponseDto(
        String chronicConditions,
        String medications,
        String allergies,
        String intolerances
) {
}
