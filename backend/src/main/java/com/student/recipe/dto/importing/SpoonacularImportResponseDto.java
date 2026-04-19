package com.student.recipe.dto.importing;

public record SpoonacularImportResponseDto(
        int requested,
        int received,
        int created,
        int updated
) {
}
