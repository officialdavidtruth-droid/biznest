import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createStoreCustomerSession,
  deleteStoreCustomerSession,
} from "@/lib/store-customer-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const action = body?.action;
    const storeId = body?.storeId;
    const customerId = body?.customerId;

    if (action === "logout") {
      await deleteStoreCustomerSession();

      return NextResponse.json({
        success: true,
      });
    }

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

    const customer = await prisma.storeCustomer.findFirst({
      where: {
  id: customerId,
  storeId,
},
      select: {
        id: true,
        storeId: true,
        name: true,
        email: true,
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

    await createStoreCustomerSession({
      customerId: customer.id,
      storeId: customer.storeId,
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        storeId: customer.storeId,
        name: customer.name,
        email: customer.email,
      },
    });
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
    await deleteStoreCustomerSession();

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
