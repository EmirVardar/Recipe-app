package com.student.recipe.dto;

public record FnddsFoodProductImportResponseDto(
        int insertedRows,
        int totalRows,
        String message
) {
}
