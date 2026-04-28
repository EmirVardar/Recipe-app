package com.student.recipe.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.importing.FnddsFoodProductImportResponseDto;
import com.student.recipe.dto.importing.FnddsRawImportResponseDto;

@Service
public class FnddsImportService {

    private static final int BATCH_SIZE = 1000;
    private static final Path FNDDS_BASE_PATH = Path.of("data", "fndds");
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy")
    );

    private final JdbcTemplate jdbcTemplate;

    public FnddsImportService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public FnddsRawImportResponseDto importRawTables() {
        ensureRequiredFilesExist();
        createRawTables();
        truncateRawTables();

        int foodRows = importFood();
        int foodNutrientRows = importFoodNutrient();
        int nutrientRows = importNutrient();
        int foodPortionRows = importFoodPortion();
        int measureUnitRows = importMeasureUnit();
        int surveyFoodRows = importSurveyFoods();

        return new FnddsRawImportResponseDto(
                foodRows,
                foodNutrientRows,
                nutrientRows,
                foodPortionRows,
                measureUnitRows,
                surveyFoodRows,
                "FNDDS raw tablolari Spring Boot icinden ice aktarildi"
        );
    }

    @Transactional
    public FnddsFoodProductImportResponseDto importFoodProducts() {
        ensureRawFoodDataExists();
        createFnddsFoodProductsTable();
        createMainFoodProductsTable();
        truncateFnddsFoodProductsTable();

        int insertedRows = jdbcTemplate.update("""
                INSERT INTO fndds_food_products (
                    fdc_id,
                    food_code,
                    wweia_category_number,
                    name,
                    default_gram_weight,
                    piece_gram_weight,
                    calories_per_100g,
                    protein_per_100g,
                    carbs_per_100g,
                    fat_per_100g
                )
                SELECT
                    food.fdc_id,
                    survey.food_code,
                    survey.wweia_category_number,
                    food.description,
                    COALESCE(portions.piece_gram_weight, portions.default_gram_weight, 100.0) AS default_gram_weight,
                    portions.piece_gram_weight,
                    MAX(CASE
                        WHEN nutrient.id IN (208, 957, 958, 1008, 2047, 2048)
                          OR nutrient.nutrient_nbr IN ('208', '957', '958')
                        THEN food_nutrient.amount
                    END) AS calories_per_100g,
                    MAX(CASE
                        WHEN nutrient.id IN (203, 1003)
                          OR nutrient.nutrient_nbr = '203'
                        THEN food_nutrient.amount
                    END) AS protein_per_100g,
                    MAX(CASE
                        WHEN nutrient.id IN (205, 1005, 2039, 1050)
                          OR nutrient.nutrient_nbr IN ('205', '205.2', '956')
                        THEN food_nutrient.amount
                    END) AS carbs_per_100g,
                    MAX(CASE
                        WHEN nutrient.id IN (204, 1004, 2044, 1085)
                          OR nutrient.nutrient_nbr IN ('204', '298', '950')
                        THEN food_nutrient.amount
                    END) AS fat_per_100g
                FROM fndds_food_raw food
                INNER JOIN fndds_survey_food_raw survey
                    ON survey.fdc_id = food.fdc_id
                LEFT JOIN fndds_food_nutrient_raw food_nutrient
                    ON food_nutrient.fdc_id = food.fdc_id
                LEFT JOIN fndds_nutrient_raw nutrient
                    ON nutrient.id = food_nutrient.nutrient_id
                    OR nutrient.nutrient_nbr = food_nutrient.nutrient_id::text
                LEFT JOIN LATERAL (
                    SELECT
                        -- 15 gram altini (sos/susleme gibi) default saymiyoruz
                        MIN(portion.gram_weight) FILTER (
                            WHERE portion.gram_weight IS NOT NULL
                              AND portion.gram_weight >= 15.0
                        ) AS default_gram_weight,
                        
                        -- Akilli Piece Gram Secimi: Standart birime (50g) en yakin olani al
                        (
                            SELECT p.gram_weight 
                            FROM fndds_food_portion_raw p
                            LEFT JOIN fndds_measure_unit_raw unit_inner ON unit_inner.id = p.measure_unit_id
                            WHERE p.fdc_id = food.fdc_id
                              AND p.gram_weight > 0
                              AND (
                                  LOWER(COALESCE(unit_inner.name, '')) IN ('piece', 'whole', 'egg', 'patty', 'link', 'slice', 'unit')
                                  OR LOWER(COALESCE(p.portion_description, '')) ~ '(whole|piece|egg|unit|each|slice)'
                                  OR LOWER(COALESCE(p.modifier, '')) ~ '(whole|piece|egg|unit|each|slice)'
                              )
                            ORDER BY ABS(p.gram_weight - 50.0) ASC, p.gram_weight DESC 
                            LIMIT 1
                        ) AS piece_gram_weight
                    FROM fndds_food_portion_raw portion
                    WHERE portion.fdc_id = food.fdc_id
                ) portions ON TRUE
                WHERE food.description IS NOT NULL
                  AND food.description <> ''
                GROUP BY
                    food.fdc_id,
                    survey.food_code,
                    survey.wweia_category_number,
                    food.description,
                    portions.default_gram_weight,
                    portions.piece_gram_weight
                """);

        syncMainFoodProducts();

        Integer totalRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM food_products", Integer.class);

        return new FnddsFoodProductImportResponseDto(
                insertedRows,
                totalRows == null ? 0 : totalRows,
                "FNDDS raw veriden aktif food_products tablosu guncellendi"
        );
    }

    // ... Geri kalan metodlar (ensureRequiredFilesExist, createRawTables, syncMainFoodProducts, readCsv, vb.) degismedi ...
    // ... Onlari oldugu gibi birakabilir veya dosyanin devamina ekleyebilirsin ...

    private void ensureRequiredFilesExist() {
        for (String fileName : List.of(
                "food.csv",
                "food_nutrient.csv",
                "nutrient.csv",
                "food_portion.csv",
                "measure_unit.csv",
                "survey_fndds_food.csv")) {
            Path path = FNDDS_BASE_PATH.resolve(fileName);
            if (!Files.exists(path)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FNDDS dosyasi bulunamadi: " + path);
            }
        }
    }

    private void ensureRawFoodDataExists() {
        Integer foodCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM fndds_food_raw", Integer.class);
        if (foodCount == null || foodCount == 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Once /api/import/fndds/raw endpointini calistirip FNDDS raw tablolarini doldur"
            );
        }
    }

    private void createRawTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS fndds_food_raw (
                    fdc_id BIGINT PRIMARY KEY,
                    data_type TEXT,
                    description TEXT,
                    food_category_id BIGINT,
                    publication_date DATE
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS fndds_food_nutrient_raw (
                    id BIGINT PRIMARY KEY,
                    fdc_id BIGINT NOT NULL,
                    nutrient_id BIGINT NOT NULL,
                    amount DOUBLE PRECISION,
                    data_points INTEGER,
                    derivation_id BIGINT,
                    min DOUBLE PRECISION,
                    max DOUBLE PRECISION,
                    median DOUBLE PRECISION,
                    footnote TEXT,
                    min_year_acquired INTEGER
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS fndds_nutrient_raw (
                    id BIGINT PRIMARY KEY,
                    name TEXT NOT NULL,
                    unit_name TEXT,
                    nutrient_nbr TEXT,
                    rank INTEGER
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS fndds_food_portion_raw (
                    id BIGINT PRIMARY KEY,
                    fdc_id BIGINT NOT NULL,
                    seq_num DOUBLE PRECISION,
                    amount DOUBLE PRECISION,
                    measure_unit_id BIGINT,
                    portion_description TEXT,
                    modifier TEXT,
                    gram_weight DOUBLE PRECISION,
                    data_points INTEGER,
                    footnote TEXT,
                    min_year_acquired INTEGER
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS fndds_measure_unit_raw (
                    id BIGINT PRIMARY KEY,
                    name TEXT NOT NULL
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS fndds_survey_food_raw (
                    fdc_id BIGINT PRIMARY KEY,
                    food_code BIGINT,
                    wweia_category_number BIGINT,
                    start_date DATE,
                    end_date DATE
                )
                """);
    }

    private void createFnddsFoodProductsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS fndds_food_products (
                    id BIGSERIAL PRIMARY KEY,
                    fdc_id BIGINT NOT NULL UNIQUE,
                    food_code BIGINT,
                    wweia_category_number BIGINT,
                    name TEXT NOT NULL,
                    default_gram_weight DOUBLE PRECISION NOT NULL DEFAULT 100.0,
                    piece_gram_weight DOUBLE PRECISION,
                    calories_per_100g DOUBLE PRECISION,
                    protein_per_100g DOUBLE PRECISION,
                    carbs_per_100g DOUBLE PRECISION,
                    fat_per_100g DOUBLE PRECISION,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """);

        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_fndds_food_products_name_lower
                ON fndds_food_products (LOWER(name))
                """);
    }

    private void createMainFoodProductsTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS food_products (
                    id BIGSERIAL PRIMARY KEY,
                    fdc_id BIGINT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    default_gram_weight DOUBLE PRECISION NOT NULL DEFAULT 100.0,
                    piece_gram_weight DOUBLE PRECISION,
                    calories_per_100g DOUBLE PRECISION,
                    protein_per_100g DOUBLE PRECISION,
                    carbs_per_100g DOUBLE PRECISION,
                    fat_per_100g DOUBLE PRECISION,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """);

        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_food_products_name_lower
                ON food_products (LOWER(name))
                """);
    }

    private void truncateRawTables() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE
                    fndds_food_nutrient_raw,
                    fndds_food_portion_raw,
                    fndds_measure_unit_raw,
                    fndds_nutrient_raw,
                    fndds_survey_food_raw,
                    fndds_food_raw
                """);
    }

    private void truncateFnddsFoodProductsTable() {
        jdbcTemplate.execute("TRUNCATE TABLE fndds_food_products RESTART IDENTITY");
    }

    private void syncMainFoodProducts() {
        jdbcTemplate.update("""
                INSERT INTO food_products (
                    fdc_id,
                    name,
                    default_gram_weight,
                    piece_gram_weight,
                    calories_per_100g,
                    protein_per_100g,
                    carbs_per_100g,
                    fat_per_100g,
                    created_at
                )
                SELECT
                    fdc_id,
                    name,
                    default_gram_weight,
                    piece_gram_weight,
                    calories_per_100g,
                    protein_per_100g,
                    carbs_per_100g,
                    fat_per_100g,
                    CURRENT_TIMESTAMP
                FROM fndds_food_products
                ON CONFLICT (fdc_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    default_gram_weight = EXCLUDED.default_gram_weight,
                    piece_gram_weight = EXCLUDED.piece_gram_weight,
                    calories_per_100g = EXCLUDED.calories_per_100g,
                    protein_per_100g = EXCLUDED.protein_per_100g,
                    carbs_per_100g = EXCLUDED.carbs_per_100g,
                    fat_per_100g = EXCLUDED.fat_per_100g
                """);
    }

    private int importFood() {
        List<Object[]> rows = readCsv("food.csv").stream()
                .map(record -> new Object[] {
                        parseLong(record.get("fdc_id")),
                        nullable(record.get("data_type")),
                        nullable(record.get("description")),
                        parseNullableLong(record.get("food_category_id")),
                        parseNullableDate(record.get("publication_date"))
                })
                .toList();

        batchInsert(
                "INSERT INTO fndds_food_raw (fdc_id, data_type, description, food_category_id, publication_date) VALUES (?, ?, ?, ?, ?)",
                rows
        );
        return rows.size();
    }

    private int importFoodNutrient() {
        List<Object[]> rows = readCsv("food_nutrient.csv").stream()
                .map(record -> new Object[] {
                        parseLong(record.get("id")),
                        parseLong(record.get("fdc_id")),
                        parseLong(record.get("nutrient_id")),
                        parseNullableDouble(record.get("amount")),
                        parseNullableInteger(record.get("data_points")),
                        parseNullableLong(record.get("derivation_id")),
                        parseNullableDouble(record.get("min")),
                        parseNullableDouble(record.get("max")),
                        parseNullableDouble(record.get("median")),
                        nullable(record.get("footnote")),
                        parseNullableInteger(record.get("min_year_acquired"))
                })
                .toList();

        batchInsert(
                """
                INSERT INTO fndds_food_nutrient_raw
                (id, fdc_id, nutrient_id, amount, data_points, derivation_id, min, max, median, footnote, min_year_acquired)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows
        );
        return rows.size();
    }

    private int importNutrient() {
        List<Object[]> rows = readCsv("nutrient.csv").stream()
                .map(record -> new Object[] {
                        parseLong(record.get("id")),
                        nullable(record.get("name")),
                        nullable(record.get("unit_name")),
                        nullable(record.get("nutrient_nbr")),
                        parseNullableInteger(record.get("rank"))
                })
                .toList();

        batchInsert(
                "INSERT INTO fndds_nutrient_raw (id, name, unit_name, nutrient_nbr, rank) VALUES (?, ?, ?, ?, ?)",
                rows
        );
        return rows.size();
    }

    private int importFoodPortion() {
        List<Object[]> rows = readCsv("food_portion.csv").stream()
                .filter(record -> hasText(record.get("id")) && hasText(record.get("fdc_id")))
                .map(record -> new Object[] {
                        parseLong(record.get("id")),
                        parseLong(record.get("fdc_id")),
                        parseNullableDouble(record.get("seq_num")),
                        parseNullableDouble(record.get("amount")),
                        parseNullableLong(record.get("measure_unit_id")),
                        nullable(record.get("portion_description")),
                        nullable(record.get("modifier")),
                        parseNullableDouble(record.get("gram_weight")),
                        parseNullableInteger(record.get("data_points")),
                        nullable(record.get("footnote")),
                        parseNullableInteger(record.get("min_year_acquired"))
                })
                .toList();

        batchInsert(
                """
                INSERT INTO fndds_food_portion_raw
                (id, fdc_id, seq_num, amount, measure_unit_id, portion_description, modifier, gram_weight, data_points, footnote, min_year_acquired)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows
        );
        return rows.size();
    }

    private int importMeasureUnit() {
        List<Object[]> rows = readCsv("measure_unit.csv").stream()
                .map(record -> new Object[] {
                        parseLong(record.get("id")),
                        nullable(record.get("name"))
                })
                .toList();

        batchInsert(
                "INSERT INTO fndds_measure_unit_raw (id, name) VALUES (?, ?)",
                rows
        );
        return rows.size();
    }

    private int importSurveyFoods() {
        List<Object[]> rows = readCsv("survey_fndds_food.csv").stream()
                .map(record -> new Object[] {
                        parseLong(record.get("fdc_id")),
                        parseNullableLong(record.get("food_code")),
                        parseNullableLong(record.get("wweia_category_number")),
                        parseNullableDate(record.get("start_date")),
                        parseNullableDate(record.get("end_date"))
                })
                .toList();

        batchInsert(
                """
                INSERT INTO fndds_survey_food_raw
                (fdc_id, food_code, wweia_category_number, start_date, end_date)
                VALUES (?, ?, ?, ?, ?)
                """,
                rows
        );
        return rows.size();
    }

    private List<CSVRecord> readCsv(String fileName) {
        Path path = FNDDS_BASE_PATH.resolve(fileName);
        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build().parse(reader)) {
            return parser.getRecords();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "CSV okunamadi: " + fileName, exception);
        }
    }

    private void batchInsert(String sql, List<Object[]> rows) {
        List<Object[]> batch = new ArrayList<>(BATCH_SIZE);
        for (Object[] row : rows) {
            batch.add(row);
            if (batch.size() == BATCH_SIZE) {
                executeBatch(sql, batch);
                batch.clear();
            }
        }

        if (!batch.isEmpty()) {
            executeBatch(sql, batch);
        }
    }

    private void executeBatch(String sql, List<Object[]> batch) {
        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                Object[] row = batch.get(i);
                for (int index = 0; index < row.length; index++) {
                    Object value = row[index];
                    if (value == null) {
                        ps.setNull(index + 1, Types.NULL);
                    } else if (value instanceof Long longValue) {
                        ps.setLong(index + 1, longValue);
                    } else if (value instanceof Integer intValue) {
                        ps.setInt(index + 1, intValue);
                    } else if (value instanceof Double doubleValue) {
                        ps.setDouble(index + 1, doubleValue);
                    } else if (value instanceof Date dateValue) {
                        ps.setDate(index + 1, dateValue);
                    } else {
                        ps.setObject(index + 1, value);
                    }
                }
            }

            @Override
            public int getBatchSize() {
                return batch.size();
            }
        });
    }

    private String nullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private long parseLong(String value) {
        return Long.parseLong(value.trim());
    }

    private Long parseNullableLong(String value) {
        return value == null || value.isBlank() ? null : Long.parseLong(value.trim());
    }

    private Integer parseNullableInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return new BigDecimal(value.trim()).intValue();
    }

    private Double parseNullableDouble(String value) {
        return value == null || value.isBlank() ? null : new BigDecimal(value.trim()).doubleValue();
    }

    private Date parseNullableDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String trimmedValue = value.trim();
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return Date.valueOf(LocalDate.parse(trimmedValue, formatter));
            } catch (DateTimeParseException ignored) {
                // Try the next supported FNDDS date format.
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Desteklenmeyen FNDDS tarih formati: " + trimmedValue
        );
    }
}