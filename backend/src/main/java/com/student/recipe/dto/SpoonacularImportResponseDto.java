package com.student.recipe.dto;

public record SpoonacularImportResponseDto(
        int requested,
        int received,
        int created,
        int updated
) {
}
