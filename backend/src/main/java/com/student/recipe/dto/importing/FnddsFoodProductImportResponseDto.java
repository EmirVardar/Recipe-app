package com.student.recipe.dto.importing;

public record FnddsFoodProductImportResponseDto(
        int insertedRows,
        int totalRows,
        String message
) {
}
