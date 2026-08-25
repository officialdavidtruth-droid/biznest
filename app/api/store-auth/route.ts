import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getStoreCustomerSession,
  signOutStoreCustomer,
} from "@/lib/store-customer-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const action = body?.action;
    const storeId = body?.storeId;
    const customerId = body?.customerId;

    // ------------------------------------------------------------
    // LOGOUT
    // ------------------------------------------------------------
    if (action === "logout") {
      await signOutStoreCustomer();

      return NextResponse.json({
        success: true,
      });
    }

    // ------------------------------------------------------------
    // LOGIN
    // ------------------------------------------------------------
    if (action !== "login") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid authentication action.",
        },
        { status: 400 }
      );
    }

    if (!storeId || !customerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Store and customer are required.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // VERIFY THAT THE CUSTOMER ACTUALLY BELONGS TO THIS STORE
    // ------------------------------------------------------------
    const customer = await prisma.storeCustomer.findFirst({
      where: {
        id: customerId,
        storeId,
      },
      select: {
        id: true,
        userId: true,
        storeId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            customerScopeStoreId: true,
            isBanned: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer account not found.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------------------------------
    // ADDITIONAL CUSTOMER SECURITY CHECKS
    // ------------------------------------------------------------
    if (customer.user.role !== "CUSTOMER") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid customer account.",
        },
        { status: 403 }
      );
    }

    if (customer.user.isBanned) {
      return NextResponse.json(
        {
          success: false,
          error: "This customer account has been banned.",
        },
        { status: 403 }
      );
    }

    if (customer.user.customerScopeStoreId !== storeId) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer does not belong to this store.",
        },
        { status: 403 }
      );
    }

    // ------------------------------------------------------------
    // CHECK WHETHER A VALID STORE CUSTOMER SESSION ALREADY EXISTS
    // ------------------------------------------------------------
    const existingSession = await getStoreCustomerSession();

    if (
      existingSession &&
      existingSession.user.id === customer.user.id &&
      existingSession.user.customerStoreId === storeId
    ) {
      return NextResponse.json({
        success: true,
        customer: {
          id: customer.id,
          userId: customer.user.id,
          storeId: customer.storeId,
          name: customer.user.name,
          email: customer.user.email,
        },
      });
    }

    // ------------------------------------------------------------
    // IMPORTANT:
    // This endpoint should NOT manufacture a login session merely
    // from customerId/storeId. Authentication must happen through
    // signInStoreCustomer(), which verifies the customer's password.
    // ------------------------------------------------------------
    return NextResponse.json(
      {
        success: false,
        error: "Customer authentication is required.",
      },
      { status: 401 }
    );
  } catch (error) {
    console.error("Store authentication error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to complete store authentication.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await signOutStoreCustomer();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Store customer logout error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to sign out.",
      },
      { status: 500 }
    );
  }
}