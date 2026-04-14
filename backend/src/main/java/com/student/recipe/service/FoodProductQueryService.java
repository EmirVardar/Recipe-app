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
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "q parametresi bos olamaz");
        }

        int safeLimit = normalizeLimit(limit);

        return jdbcTemplate.query(
                """
                SELECT
                    ranked.id,
                    ranked.fdc_id,
                    ranked.name,
                    ranked.default_gram_weight,
                    ranked.piece_gram_weight,
                    ranked.calories_per_100g,
                    ranked.protein_per_100g,
                    ranked.carbs_per_100g,
                    ranked.fat_per_100g
                FROM (
                    SELECT DISTINCT ON (LOWER(name))
                        id,
                        fdc_id,
                        name,
                        default_gram_weight,
                        piece_gram_weight,
                        calories_per_100g,
                        protein_per_100g,
                        carbs_per_100g,
                        fat_per_100g,
                        CASE
                            WHEN LOWER(name) = LOWER(?) THEN 0
                            WHEN LOWER(name) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?) THEN 1
                            WHEN LOWER(name) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?) THEN 2
                            ELSE 4
                        END AS search_rank,
                        (
                            CASE WHEN calories_per_100g IS NOT NULL THEN 1 ELSE 0 END +
                            CASE WHEN protein_per_100g IS NOT NULL THEN 1 ELSE 0 END +
                            CASE WHEN carbs_per_100g IS NOT NULL THEN 1 ELSE 0 END +
                            CASE WHEN fat_per_100g IS NOT NULL THEN 1 ELSE 0 END
                        ) AS nutrition_score,
                        CASE
                            WHEN LOWER(name) LIKE LOWER(?)
                              OR LOWER(name) LIKE LOWER(?)
                              OR LOWER(name) LIKE LOWER(?)
                              OR LOWER(name) LIKE LOWER(?)
                              OR LOWER(name) LIKE LOWER(?)
                            THEN 0
                            ELSE 1
                        END AS basic_food_rank,
                        CASE
                            WHEN LOWER(name) LIKE '% with %'
                              OR LOWER(name) LIKE '% and %'
                              OR LOWER(name) LIKE '% burrito%'
                              OR LOWER(name) LIKE '% benedict%'
                              OR LOWER(name) LIKE '% casserole%'
                              OR LOWER(name) LIKE '% salad%'
                              OR LOWER(name) LIKE '% sandwich%'
                              OR LOWER(name) LIKE '% burger%'
                              OR LOWER(name) LIKE '% taco%'
                              OR LOWER(name) LIKE '% pizza%'
                              OR LOWER(name) LIKE '% deviled%'
                              OR LOWER(name) LIKE '% creamed%'
                              OR LOWER(name) LIKE '% foo yung%'
                              OR LOWER(name) LIKE '% egg roll%'
                              OR LOWER(name) LIKE '% eggnog%'
                              OR LOWER(name) LIKE '% dried%'
                              OR LOWER(name) LIKE '% frozen%'
                              OR LOWER(name) LIKE '% pasteurized%'
                              OR LOWER(name) LIKE '% dehydrated%'
                              OR LOWER(name) LIKE '% powdered%'
                              OR LOWER(name) LIKE '% powder%'
                              OR LOWER(name) LIKE '% canned%'
                              OR LOWER(name) LIKE '%brand%'
                              OR LOWER(name) LIKE '%producer%'
                            THEN 1
                            ELSE 0
                        END AS composite_penalty,
                        CASE WHEN LOWER(name) ~ '[0-9]{4,}' THEN 1 ELSE 0 END AS code_penalty,
                        LENGTH(name) AS name_length
                    FROM food_products
                    WHERE LOWER(name) LIKE LOWER(?)
                    ORDER BY
                        LOWER(name),
                        basic_food_rank ASC,
                        composite_penalty ASC,
                        nutrition_score DESC,
                        search_rank ASC,
                        code_penalty ASC,
                        name_length ASC,
                        id ASC
                ) ranked
                ORDER BY
                    ranked.search_rank ASC,
                    ranked.basic_food_rank ASC,
                    ranked.composite_penalty ASC,
                    ranked.nutrition_score DESC,
                    ranked.code_penalty ASC,
                    ranked.name_length ASC,
                    ranked.name ASC
                LIMIT ?
                """,
                foodProductRowMapper(),
                normalizedQuery,
                normalizedQuery + ",%",
                normalizedQuery + " %",
                "% " + normalizedQuery + ",%",
                "% " + normalizedQuery + " %",
                "% " + normalizedQuery,
                normalizedQuery + ", whole%",
                normalizedQuery + ", white%",
                normalizedQuery + ", yolk%",
                normalizedQuery + ", cooked%",
                normalizedQuery + ", boiled%",
                "%" + normalizedQuery + "%",
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
