package com.student.recipe.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.HealthTransferRecord;

public interface HealthTransferRecordRepository extends JpaRepository<HealthTransferRecord, Long> {

    java.util.List<HealthTransferRecord> findTop100ByOrderByDateDesc();
}