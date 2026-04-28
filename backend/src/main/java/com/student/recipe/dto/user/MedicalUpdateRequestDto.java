package com.student.recipe.dto.user;

public record MedicalUpdateRequestDto(
        String chronicConditions,
        String medications,
        String allergies,
        String intolerances
) {
}
