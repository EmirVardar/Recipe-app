package com.student.recipe.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.FoodProductSearchItemDto;

@Service
public class FoodProductQueryService {

    private static final int DEFAULT_LIMIT = 3;
    private static final int MAX_LIMIT = 50;

    private final JdbcTemplate jdbcTemplate;

    public FoodProductQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<FoodProductSearchItemDto> search(String query, Integer limit) {
        String normalizedQuery = (query == null) ? "" : query.trim();
        if (normalizedQuery.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "q parametresi bos olamaz");
        }

        int safeLimit = normalizeLimit(limit);

        // Kelimeleri PostgreSQL'in FTS formatına getiriyoruz (örn: "boiled potato" -> "boiled & potato")
        String tsQuery = normalizedQuery.trim().replaceAll("\\s+", " & ");

        return jdbcTemplate.query(
                """
                SELECT
                    results.id,
                    results.fdc_id,
                    results.name,
                    results.default_gram_weight,
                    results.piece_gram_weight,
                    results.calories_per_100g,
                    results.protein_per_100g,
                    results.carbs_per_100g,
                    results.fat_per_100g
                FROM (
                    SELECT DISTINCT ON (name)
                        id,
                        fdc_id,
                        name,
                        default_gram_weight,
                        piece_gram_weight,
                        calories_per_100g,
                        protein_per_100g,
                        carbs_per_100g,
                        fat_per_100g,
                        -- 1. Full Text Search Rank (Kelime eşleşme kalitesi)
                        ts_rank(to_tsvector('english', name), to_tsquery('english', ?)) AS word_rank,
                        -- 2. Trigram Similarity (Yazım hatası toleransı)
                        similarity(name, ?) AS sim_score,
                        -- 3. Temel Gıda Önceliği (Sadece isim olanlar veya haşlanmış/çiğ gibi temel yöntemler)
                        CASE 
                            WHEN name NOT LIKE '%,%' THEN 2 
                            WHEN name ILIKE ANY (ARRAY['%boiled%', '%raw%', '%baked%', '%roasted%']) THEN 1
                            ELSE 0 
                        END AS basic_priority,
                        -- 4. Teknik Terim Cezası (NFS, Salt, Ready-to-heat gibi gürültüleri arkaya itmek için)
                        CASE 
                            WHEN name ILIKE '%NFS%' OR name ILIKE '%specified%' OR name ILIKE '%fat added%' THEN -1
                            ELSE 0
                        END AS noise_penalty
                    FROM food_products
                    WHERE 
                        to_tsvector('english', name) @@ to_tsquery('english', ?) -- Kelime bazlı arama
                        OR name % ? -- Benzerlik bazlı arama (Yazım hatası için)
                ) results
                ORDER BY 
                    -- 1. KESİN ÖNCELİK: Tam eşleşme, sonra "Egg, ..." formatı, sonra diğer başlangıçlar
                    (CASE 
                        WHEN results.name ILIKE ? THEN 1
                        WHEN results.name ILIKE (? || ',%') THEN 2
                        WHEN results.name ILIKE (? || '%') THEN 3
                        ELSE 4
                    END) ASC,

                    -- 2. Diğer akıllı skorlar
                    (results.word_rank * 2 + results.sim_score + results.basic_priority + results.noise_penalty) DESC,

                    -- 3. Kısa isim daha sade kabul ediliyor
                    LENGTH(results.name) ASC
                LIMIT ?
                """,
                foodProductRowMapper(),
                tsQuery,           // ts_rank için
                normalizedQuery,   // similarity için
                tsQuery,           // WHERE @@ için
                normalizedQuery,   // WHERE % için
                normalizedQuery,   // exact match ORDER BY için
                normalizedQuery,   // comma-prefix ORDER BY için
                normalizedQuery,   // prefix ORDER BY için
                safeLimit
        );
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        if (limit < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit 1'den kucuk olamaz");
        }
        if (limit > MAX_LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit 50'den buyuk olamaz");
        }
        return limit;
    }

    private RowMapper<FoodProductSearchItemDto> foodProductRowMapper() {
        return (resultSet, rowNum) -> mapFoodProduct(resultSet);
    }

    private FoodProductSearchItemDto mapFoodProduct(ResultSet resultSet) throws SQLException {
        return new FoodProductSearchItemDto(
                resultSet.getLong("id"),
                resultSet.getLong("fdc_id"),
                resultSet.getString("name"),
                getNullableDouble(resultSet, "default_gram_weight"),
                getNullableDouble(resultSet, "piece_gram_weight"),
                getNullableDouble(resultSet, "calories_per_100g"),
                getNullableDouble(resultSet, "protein_per_100g"),
                getNullableDouble(resultSet, "carbs_per_100g"),
                getNullableDouble(resultSet, "fat_per_100g")
        );
    }

    private Double getNullableDouble(ResultSet resultSet, String columnName) throws SQLException {
        double value = resultSet.getDouble(columnName);
        return resultSet.wasNull() ? null : value;
    }
}
