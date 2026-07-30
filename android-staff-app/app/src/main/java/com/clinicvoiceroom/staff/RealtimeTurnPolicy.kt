package com.clinicvoiceroom.staff

internal fun matchesRealtimeResponseId(expectedResponseId: String?, eventResponseId: String): Boolean {
    return !expectedResponseId.isNullOrBlank() && eventResponseId == expectedResponseId
}
