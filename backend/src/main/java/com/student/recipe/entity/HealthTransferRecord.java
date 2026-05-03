package com.student.recipe.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "health_transfer_records")
public class HealthTransferRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer adim;

    @Column(nullable = false)
    private Double kalori;

    @Column(nullable = false)
    private LocalDate date;

    @PrePersist
    void onCreate() {
        if (this.date == null) {
            this.date = LocalDate.now();
        }
    }
}