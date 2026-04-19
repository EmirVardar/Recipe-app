package com.student.recipe.dto;

public record SpoonacularQuerySeedImportResponseDto(
        int requested,
        int imported,
        String sourceFile,
        String message
) {
}
