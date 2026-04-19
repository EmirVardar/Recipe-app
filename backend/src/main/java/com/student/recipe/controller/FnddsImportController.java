package com.student.recipe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.importing.FnddsFoodProductImportResponseDto;
import com.student.recipe.dto.importing.FnddsRawImportResponseDto;
import com.student.recipe.service.FnddsImportService;

@RestController
@RequestMapping("/api/import/fndds")
public class FnddsImportController {

    private final FnddsImportService fnddsImportService;

    public FnddsImportController(FnddsImportService fnddsImportService) {
        this.fnddsImportService = fnddsImportService;
    }

    @PostMapping("/raw")
    public ResponseEntity<FnddsRawImportResponseDto> importRaw() {
        return ResponseEntity.ok(fnddsImportService.importRawTables());
    }

    @PostMapping("/products")
    public ResponseEntity<FnddsFoodProductImportResponseDto> importProducts() {
        return ResponseEntity.ok(fnddsImportService.importFoodProducts());
    }
}
