package com.student.recipe.dto.importing;

public record SpoonacularQuerySeedImportResponseDto(
        int requested,
        int imported,
        String sourceFile,
        String message
) {
}
