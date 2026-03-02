package com.student.recipe.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.UserMedical;

public interface UserMedicalRepository extends JpaRepository<UserMedical, Long> {

    Optional<UserMedical> findByUserId(Long userId);
}
