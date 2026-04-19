package com.student.recipe.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.SpoonacularQuerySeedImportResponseDto;
import com.student.recipe.entity.ImportQuery;
import com.student.recipe.repository.ImportQueryRepository;

@Service
public class SpoonacularQuerySeedImportService {

    private static final int MAX_QUERY_LENGTH = 120;

    private final ImportQueryRepository importQueryRepository;
    private final String querySourceFile;

    public SpoonacularQuerySeedImportService(
            ImportQueryRepository importQueryRepository,
            @Value("${spoonacular.query-source-file:data/fndds/newfood.csv}") String querySourceFile
    ) {
        this.importQueryRepository = importQueryRepository;
        this.querySourceFile = querySourceFile;
    }

    @Transactional
    public SpoonacularQuerySeedImportResponseDto importQueries(int requestedLimit) {
        int limit = normalizeLimit(requestedLimit);
        Path csvPath = Path.of(querySourceFile);

        if (!Files.exists(csvPath)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "CSV dosyasi bulunamadi: " + csvPath
            );
        }

        int imported = 0;
        Set<String> seenInBatch = new HashSet<>();

        try (BufferedReader reader = Files.newBufferedReader(csvPath, StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setTrim(true)
                     .get()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                if (imported >= limit) {
                    break;
                }

                String rawTitle = record.get("title");
                String normalizedQuery = normalizeQuery(rawTitle);
                if (normalizedQuery == null) {
                    continue;
                }

                String batchKey = normalizedQuery.toLowerCase();
                if (!seenInBatch.add(batchKey)) {
                    continue;
                }

                if (importQueryRepository.findByQueryTextIgnoreCase(normalizedQuery).isPresent()) {
                    continue;
                }

                ImportQuery importQuery = new ImportQuery();
                importQuery.setQueryText(normalizedQuery);
                importQuery.setCompleted(false);
                importQueryRepository.save(importQuery);
                imported++;
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "CSV dosyasi okunamadi",
                    exception
            );
        }

        return new SpoonacularQuerySeedImportResponseDto(
                limit,
                imported,
                csvPath.toString(),
                "newfood.csv icindeki basliklar import_queries tablosuna aktarildi"
        );
    }

    private int normalizeLimit(int requestedLimit) {
        if (requestedLimit < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit en az 1 olmali");
        }

        if (requestedLimit > 5000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit en fazla 5000 olabilir");
        }

        return requestedLimit;
    }

    private String normalizeQuery(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim()
                .replaceAll("\\s+", " ");

        if (normalized.isBlank()) {
            return null;
        }

        if (normalized.length() > MAX_QUERY_LENGTH) {
            normalized = normalized.substring(0, MAX_QUERY_LENGTH).trim();
        }

        return normalized.isBlank() ? null : normalized;
    }
}
